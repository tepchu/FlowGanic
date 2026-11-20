import os
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO

import app


def besok(tambah=3):
    return (date.today() + timedelta(days=tambah)).isoformat()


class FlowganicTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app.DB_PATH = os.path.join(self.temp.name, "test.db")
        app.siapkan_data()

    def tearDown(self):
        app.API_KEY = ""
        self.temp.cleanup()

    def handler(self):
        handler = app.Api.__new__(app.Api)
        self.hasil = []
        handler.kirim = lambda kode, isi: self.hasil.append((kode, isi))
        handler.headers = {}
        return handler

    def ajukan(self, ref="rt03-rumah-12", wilayah="rw05-lebak-siliwangi",
               jenis="ORGANIK", kg=20, jadwal=None):
        return app.ajukan_permintaan(ref, wilayah, jenis, kg, jadwal or besok())

    # --- Identitas dan Wilayah ------------------------------------------------

    def test_wilayah_menandai_pilot(self):
        data = app.semua_wilayah()
        pilot = [w for w in data["wilayah"] if w["pilot"]]
        self.assertEqual([w["id"] for w in pilot], ["rw05-lebak-siliwangi"])
        self.assertTrue(all(w["kota"] == "Kota Bandung" for w in data["wilayah"]))

    def test_pengolah_disaring_wilayah_dan_jenis(self):
        semua = app.daftar_pengolah()["pengolah"]
        self.assertEqual(len(semua), 4)
        organik = app.daftar_pengolah("rw05-lebak-siliwangi", "ORGANIK")["pengolah"]
        self.assertEqual({p["id"] for p in organik}, {"bsf-lebak", "komposter-coblong"})
        kosong = app.daftar_pengolah("rw03-dago", "ORGANIK")["pengolah"]
        self.assertEqual(kosong, [])
        # Saringan tidak boleh memangkas cakupan yang ditampilkan.
        bsf = next(p for p in organik if p["id"] == "bsf-lebak")
        self.assertEqual(sorted(bsf["melayani_wilayah"]),
                         ["rw05-lebak-siliwangi", "rw07-lebak-gede"])
        with self.assertRaises(ValueError):
            app.daftar_pengolah(jenis="KACA")

    # --- Koordinasi Distribusi Sampah ----------------------------------------

    def test_pengajuan_dicocokkan_ke_pengolah(self):
        hasil = self.ajukan()
        self.assertEqual(hasil["status"], "dijadwalkan")
        self.assertIn(hasil["pengolah_id"], ("bsf-lebak", "komposter-coblong"))
        self.assertFalse(hasil["duplikat"])

    def test_kapasitas_habis_membuat_permintaan_menunggu(self):
        jadwal = besok()
        # Kapasitas organik di RW 05: 120 + 80 kg. Tiga permintaan 100 kg
        # menghabiskan keduanya, yang ketiga tidak tertampung.
        a = self.ajukan(ref="rumah-a", kg=100, jadwal=jadwal)
        b = self.ajukan(ref="rumah-b", kg=80, jadwal=jadwal)
        c = self.ajukan(ref="rumah-c", kg=100, jadwal=jadwal)
        self.assertEqual(a["status"], "dijadwalkan")
        self.assertEqual(b["status"], "dijadwalkan")
        self.assertNotEqual(a["pengolah_id"], b["pengolah_id"])
        self.assertEqual(c["status"], "diajukan")
        self.assertIsNone(c["pengolah_id"])

    def test_pengiriman_ulang_tidak_menggandakan(self):
        jadwal = besok()
        pertama = self.ajukan(jadwal=jadwal)
        kedua = self.ajukan(jadwal=jadwal)
        self.assertTrue(kedua["duplikat"])
        self.assertEqual(pertama["id"], kedua["id"])

    def test_validasi_pengajuan(self):
        with self.assertRaises(ValueError):
            self.ajukan(ref="Rumah 12!")
        with self.assertRaises(ValueError):
            self.ajukan(jenis="KACA")
        with self.assertRaises(ValueError):
            self.ajukan(kg=0)
        with self.assertRaises(ValueError):
            self.ajukan(kg=True)
        with self.assertRaises(ValueError):
            self.ajukan(jadwal="kemarin")
        with self.assertRaises(ValueError):
            self.ajukan(jadwal=(date.today() - timedelta(days=1)).isoformat())
        with self.assertRaises(LookupError):
            self.ajukan(wilayah="rw99-entah")

    def test_tolak_mencari_pengolah_lain(self):
        permintaan = self.ajukan(kg=20)
        semula = permintaan["pengolah_id"]
        setelah = app.perbarui_permintaan(permintaan["id"], "tolak")
        self.assertEqual(setelah["status"], "dijadwalkan")
        self.assertNotEqual(setelah["pengolah_id"], semula)

    def test_tolak_tanpa_pengolah_lain_menutup_permintaan(self):
        permintaan = self.ajukan(jenis="RESIDU", kg=50)
        setelah = app.perbarui_permintaan(permintaan["id"], "tolak")
        self.assertEqual(setelah["status"], "ditolak")
        self.assertIsNone(setelah["pengolah_id"])

    def test_selesai_mengonfirmasi_volume(self):
        permintaan = self.ajukan(kg=20)
        selesai = app.perbarui_permintaan(permintaan["id"], "selesai", 23)
        self.assertEqual(selesai["status"], "selesai")
        self.assertEqual(selesai["volume_kg"], 23)
        self.assertEqual(selesai["perkiraan_kg"], 20)
        with self.assertRaises(ValueError):
            app.perbarui_permintaan(permintaan["id"], "selesai", 23)

    def test_selesai_butuh_volume_yang_sah(self):
        permintaan = self.ajukan()
        for buruk in (None, 0, -5, "20", True):
            with self.assertRaises(ValueError):
                app.perbarui_permintaan(permintaan["id"], "selesai", buruk)
        with self.assertRaises(ValueError):
            app.perbarui_permintaan(permintaan["id"], "entah")
        with self.assertRaises(LookupError):
            app.perbarui_permintaan("tidak-ada", "terima")

    def test_penghasil_tidak_berubah_setelah_diperbarui(self):
        permintaan = self.ajukan(ref="rt03-rumah-12")
        setelah = app.perbarui_permintaan(permintaan["id"], "terima")
        self.assertEqual(setelah["penghasil_ref"], "rt03-rumah-12")

    # --- Analitik dan Pelaporan ----------------------------------------------

    def test_rekap_agregat_dan_anonim(self):
        jadwal = besok()
        a = self.ajukan(ref="rumah-a", kg=20, jadwal=jadwal)
        app.perbarui_permintaan(a["id"], "selesai", 25)
        self.ajukan(ref="rumah-b", jenis="ANORGANIK", kg=10, jadwal=jadwal)

        hasil = app.rekap()
        self.assertEqual(hasil["total"]["permintaan"], 2)
        self.assertEqual(hasil["total"]["selesai"], 1)
        self.assertEqual(hasil["total"]["terkelola_kg"], 25)
        self.assertEqual(hasil["per_jenis"]["ORGANIK"]["selesai"], 1)
        self.assertEqual(hasil["per_jenis"]["ANORGANIK"]["selesai"], 0)
        self.assertNotIn("rumah-a", repr(hasil))
        self.assertNotIn(a["id"], repr(hasil))

    def test_rekap_menyaring_jenis_dan_tanggal(self):
        self.ajukan(ref="rumah-a", kg=20, jadwal=besok(2))
        self.ajukan(ref="rumah-b", jenis="ANORGANIK", kg=10, jadwal=besok(9))
        self.assertEqual(app.rekap(jenis="ORGANIK")["total"]["permintaan"], 1)
        self.assertEqual(app.rekap(dari=besok(5))["total"]["permintaan"], 1)
        self.assertEqual(app.rekap(sampai=besok(5))["total"]["permintaan"], 1)
        with self.assertRaises(ValueError):
            app.rekap(dari="bukan-tanggal")

    # --- Lapisan HTTP ---------------------------------------------------------

    def test_http_get(self):
        handler = self.handler()
        permintaan = self.ajukan()
        for path, kode in [
            ("/api/health", 200),
            ("/api/wilayah", 200),
            ("/api/pengolah?wilayah_id=rw05-lebak-siliwangi&jenis=ORGANIK", 200),
            ("/api/rekap", 200),
            (f"/api/permintaan/{permintaan['id']}", 200),
            ("/api/permintaan/tidak-ada", 404),
            ("/api/pengolah?jenis=KACA", 400),
            ("/api/entah", 404),
        ]:
            handler.path = path
            handler.do_GET()
            self.assertEqual(self.hasil.pop()[0], kode, path)

    def test_http_post_dan_patch(self):
        handler = self.handler()
        isi = ('{"penghasil_ref":"rt03-rumah-12","wilayah_id":"rw05-lebak-siliwangi",'
               '"jenis":"ORGANIK","perkiraan_kg":20,"jadwal":"%s"}' % besok()).encode()
        handler.path = "/api/permintaan"
        handler.headers = {"Content-Length": str(len(isi))}
        handler.rfile = BytesIO(isi)
        handler.do_POST()
        kode, dibuat = self.hasil.pop()
        self.assertEqual(kode, 201)

        handler.rfile = BytesIO(isi)
        handler.do_POST()
        kode_ulang, _ = self.hasil.pop()
        self.assertEqual(kode_ulang, 200)

        patch = b'{"aksi":"selesai","volume_kg":22}'
        handler.path = f"/api/permintaan/{dibuat['id']}"
        handler.headers = {"Content-Length": str(len(patch))}
        handler.rfile = BytesIO(patch)
        handler.do_PATCH()
        kode_patch, akhir = self.hasil.pop()
        self.assertEqual(kode_patch, 200)
        self.assertEqual(akhir["status"], "selesai")

        for payload, kode in [(b'{"aksi":"entah"}', 400), (b'\xff', 400)]:
            handler.headers = {"Content-Length": str(len(payload))}
            handler.rfile = BytesIO(payload)
            handler.do_PATCH()
            self.assertEqual(self.hasil.pop()[0], kode)

    def test_api_key(self):
        app.API_KEY = "kunci-uji"
        handler = self.handler()

        handler.path = "/api/health"
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 200)

        handler.path = "/api/wilayah"
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 401)

        handler.headers = {"X-API-Key": "salah"}
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 401)

        handler.headers = {"X-API-Key": "kunci-uji"}
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 200)

        handler.path = "/api/permintaan"
        handler.headers = {}
        handler.do_POST()
        self.assertEqual(self.hasil.pop()[0], 401)

    def test_lintas_asal(self):
        handler = self.handler()
        terkirim = []
        handler.send_response = lambda kode: terkirim.append(("status", kode))
        handler.send_header = lambda nama, nilai: terkirim.append((nama, nilai))
        handler.end_headers = lambda: None
        handler.do_OPTIONS()
        kepala = dict(terkirim)
        self.assertEqual(kepala["status"], 204)
        self.assertEqual(kepala["Access-Control-Allow-Origin"], "*")
        self.assertIn("PATCH", kepala["Access-Control-Allow-Methods"])


if __name__ == "__main__":
    unittest.main()

import hmac
import json
import os
import re
import sqlite3
import uuid
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo


DB_PATH = os.environ.get("DB_PATH", "/tmp/flowganic.db")
API_KEY = os.environ.get("API_KEY", "")
TANPA_KUNCI = {"/api/health"}
ZONA = ZoneInfo("Asia/Jakarta")

JENIS_SAMPAH = ("ORGANIK", "ANORGANIK", "RESIDU")
# diajukan  : belum ada pengolah yang sanggup pada tanggal itu
# dijadwalkan: sudah dicocokkan ke pengolah
# ditolak   : tidak ada pengolah yang dapat melayani
# selesai   : sampah diterima dan volumenya dikonfirmasi pengolah
STATUS_TERBUKA = ("diajukan", "dijadwalkan")

WILAYAH = [
    ("rw05-lebak-siliwangi", "RW 05 Lebak Siliwangi", "Coblong", 1),
    ("rw07-lebak-gede", "RW 07 Lebak Gede", "Coblong", 0),
    ("rw03-dago", "RW 03 Dago", "Coblong", 0),
]
PENGOLAH = [
    ("bsf-lebak", "Rumah Maggot BSF Lebak Siliwangi", 120),
    ("komposter-coblong", "Komposter Komunal Coblong", 80),
    ("bank-sampah-dago", "Bank Sampah Dago Pojok", 150),
    ("tps-residu-coblong", "TPS Residu Coblong", 300),
]
LAYANAN = [
    ("bsf-lebak", "rw05-lebak-siliwangi", "ORGANIK"),
    ("bsf-lebak", "rw07-lebak-gede", "ORGANIK"),
    ("komposter-coblong", "rw05-lebak-siliwangi", "ORGANIK"),
    ("bank-sampah-dago", "rw05-lebak-siliwangi", "ANORGANIK"),
    ("bank-sampah-dago", "rw03-dago", "ANORGANIK"),
    ("tps-residu-coblong", "rw05-lebak-siliwangi", "RESIDU"),
    ("tps-residu-coblong", "rw07-lebak-gede", "RESIDU"),
    ("tps-residu-coblong", "rw03-dago", "RESIDU"),
]


def koneksi():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def siapkan_data():
    with koneksi() as db:
        db.execute("CREATE TABLE IF NOT EXISTS wilayah (id TEXT PRIMARY KEY, nama TEXT, kecamatan TEXT, pilot INTEGER)")
        db.execute("CREATE TABLE IF NOT EXISTS pengolah (id TEXT PRIMARY KEY, nama TEXT, kapasitas_kg INTEGER)")
        db.execute("CREATE TABLE IF NOT EXISTS layanan (pengolah_id TEXT, wilayah_id TEXT, jenis TEXT, PRIMARY KEY (pengolah_id, wilayah_id, jenis))")
        db.execute(
            "CREATE TABLE IF NOT EXISTS permintaan ("
            "id TEXT PRIMARY KEY, penghasil_ref TEXT, wilayah_id TEXT, jenis TEXT,"
            " perkiraan_kg INTEGER, jadwal TEXT, status TEXT, pengolah_id TEXT,"
            " volume_kg INTEGER, dibuat_pada TEXT, diperbarui_pada TEXT)"
        )
        db.executemany("INSERT OR IGNORE INTO wilayah VALUES (?, ?, ?, ?)", WILAYAH)
        db.executemany("INSERT OR IGNORE INTO pengolah VALUES (?, ?, ?)", PENGOLAH)
        db.executemany("INSERT OR IGNORE INTO layanan VALUES (?, ?, ?)", LAYANAN)


def sekarang():
    return datetime.now(ZONA).isoformat(timespec="seconds")


# --- Konteks Identitas dan Wilayah -------------------------------------------

def semua_wilayah():
    with koneksi() as db:
        baris = db.execute("SELECT * FROM wilayah ORDER BY nama").fetchall()
    return {
        "wilayah": [
            {"id": r["id"], "nama": r["nama"], "kecamatan": r["kecamatan"],
             "kota": "Kota Bandung", "pilot": bool(r["pilot"])}
            for r in baris
        ],
        "sumber": "data_contoh",
    }


def daftar_pengolah(wilayah_id=None, jenis=None):
    if jenis and jenis not in JENIS_SAMPAH:
        raise ValueError(f"jenis harus salah satu dari {', '.join(JENIS_SAMPAH)}")
    # Saringan menentukan pengolah mana yang masuk daftar, lalu cakupan
    # layanannya ditampilkan utuh agar tidak terbaca lebih sempit dari aslinya.
    syarat, nilai = [], []
    if wilayah_id:
        syarat.append("wilayah_id = ?")
        nilai.append(wilayah_id)
    if jenis:
        syarat.append("jenis = ?")
        nilai.append(jenis)
    pilih = "SELECT DISTINCT pengolah_id FROM layanan"
    if syarat:
        pilih += " WHERE " + " AND ".join(syarat)
    with koneksi() as db:
        terpilih = [r["pengolah_id"] for r in db.execute(pilih, nilai)]
        if not terpilih:
            return {"pengolah": [], "sumber": "data_contoh"}
        tanya = ",".join("?" * len(terpilih))
        baris = db.execute(
            "SELECT p.id, p.nama, p.kapasitas_kg, l.wilayah_id, l.jenis FROM pengolah p"
            f" JOIN layanan l ON l.pengolah_id = p.id WHERE p.id IN ({tanya})"
            " ORDER BY p.nama", terpilih,
        ).fetchall()
    terkumpul = {}
    for r in baris:
        p = terkumpul.setdefault(r["id"], {
            "id": r["id"], "nama": r["nama"], "kapasitas_kg_per_hari": r["kapasitas_kg"],
            "melayani_wilayah": [], "menerima_jenis": [],
        })
        if r["wilayah_id"] not in p["melayani_wilayah"]:
            p["melayani_wilayah"].append(r["wilayah_id"])
        if r["jenis"] not in p["menerima_jenis"]:
            p["menerima_jenis"].append(r["jenis"])
    return {"pengolah": list(terkumpul.values()), "sumber": "data_contoh"}


# --- Konteks inti: Koordinasi Distribusi Sampah -------------------------------

def muatan(db, pengolah_id, jadwal):
    baris = db.execute(
        "SELECT COALESCE(SUM(COALESCE(volume_kg, perkiraan_kg)), 0) AS kg FROM permintaan"
        " WHERE pengolah_id = ? AND jadwal = ? AND status IN ('dijadwalkan', 'selesai')",
        (pengolah_id, jadwal),
    ).fetchone()
    return baris["kg"]


def cocokkan(db, wilayah_id, jenis, perkiraan_kg, jadwal, kecuali=()):
    """Pilih pengolah yang melayani wilayah dan jenis itu, yang sisa kapasitas
    hariannya masih cukup. Sisa terbesar menang agar beban menyebar."""
    calon = db.execute(
        "SELECT p.id, p.kapasitas_kg FROM pengolah p JOIN layanan l ON l.pengolah_id = p.id"
        " WHERE l.wilayah_id = ? AND l.jenis = ? ORDER BY p.id",
        (wilayah_id, jenis),
    ).fetchall()
    terbaik, sisa_terbaik = None, -1
    for c in calon:
        if c["id"] in kecuali:
            continue
        sisa = c["kapasitas_kg"] - muatan(db, c["id"], jadwal)
        if sisa >= perkiraan_kg and sisa > sisa_terbaik:
            terbaik, sisa_terbaik = c["id"], sisa
    return terbaik


def bentuk(r):
    return {
        "id": r["id"],
        "penghasil_ref": r["penghasil_ref"],
        "wilayah_id": r["wilayah_id"],
        "jenis": r["jenis"],
        "perkiraan_kg": r["perkiraan_kg"],
        "jadwal": r["jadwal"],
        "status": r["status"],
        "pengolah_id": r["pengolah_id"],
        "volume_kg": r["volume_kg"],
        "dibuat_pada": r["dibuat_pada"],
        "diperbarui_pada": r["diperbarui_pada"],
    }


def periksa_pengajuan(penghasil_ref, wilayah_id, jenis, perkiraan_kg, jadwal):
    if not isinstance(penghasil_ref, str) or not re.fullmatch(r"[a-z0-9-]{3,40}", penghasil_ref or ""):
        raise ValueError("penghasil_ref wajib berupa kode anonim a-z, 0-9, dan tanda hubung")
    if jenis not in JENIS_SAMPAH:
        raise ValueError(f"jenis harus salah satu dari {', '.join(JENIS_SAMPAH)}")
    if type(perkiraan_kg) is not int or perkiraan_kg <= 0 or perkiraan_kg > 1000:
        raise ValueError("perkiraan_kg harus bilangan bulat antara 1 dan 1000")
    try:
        tanggal = date.fromisoformat(jadwal)
    except (TypeError, ValueError):
        raise ValueError("jadwal harus tanggal berformat YYYY-MM-DD")
    if tanggal < datetime.now(ZONA).date():
        raise ValueError("jadwal tidak boleh tanggal yang sudah lewat")


def ajukan_permintaan(penghasil_ref, wilayah_id, jenis, perkiraan_kg, jadwal):
    periksa_pengajuan(penghasil_ref, wilayah_id, jenis, perkiraan_kg, jadwal)
    with koneksi() as db:
        if not db.execute("SELECT 1 FROM wilayah WHERE id = ?", (wilayah_id,)).fetchone():
            raise LookupError("Wilayah tidak ditemukan")
        # Aturan Tugas 1: pengiriman ulang tidak menggandakan permintaan.
        ada = db.execute(
            "SELECT * FROM permintaan WHERE penghasil_ref = ? AND wilayah_id = ?"
            " AND jenis = ? AND jadwal = ? AND status IN ('diajukan', 'dijadwalkan')",
            (penghasil_ref, wilayah_id, jenis, jadwal),
        ).fetchone()
        if ada:
            hasil = bentuk(ada)
            hasil["duplikat"] = True
            return hasil

        pengolah_id = cocokkan(db, wilayah_id, jenis, perkiraan_kg, jadwal)
        waktu = sekarang()
        baru = (
            uuid.uuid4().hex[:12], penghasil_ref, wilayah_id, jenis, perkiraan_kg, jadwal,
            "dijadwalkan" if pengolah_id else "diajukan", pengolah_id, None, waktu, waktu,
        )
        db.execute("INSERT INTO permintaan VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", baru)
        r = db.execute("SELECT * FROM permintaan WHERE id = ?", (baru[0],)).fetchone()
    hasil = bentuk(r)
    hasil["duplikat"] = False
    return hasil


def ambil_permintaan(permintaan_id):
    with koneksi() as db:
        r = db.execute("SELECT * FROM permintaan WHERE id = ?", (permintaan_id,)).fetchone()
    if not r:
        raise LookupError("Permintaan tidak ditemukan")
    return bentuk(r)


def perbarui_permintaan(permintaan_id, aksi, volume_kg=None):
    if aksi not in ("terima", "tolak", "selesai"):
        raise ValueError("aksi harus terima, tolak, atau selesai")
    with koneksi() as db:
        r = db.execute("SELECT * FROM permintaan WHERE id = ?", (permintaan_id,)).fetchone()
        if not r:
            raise LookupError("Permintaan tidak ditemukan")
        if r["status"] not in STATUS_TERBUKA:
            raise ValueError(f"Permintaan sudah {r['status']} dan tidak dapat diubah lagi")

        if aksi == "terima":
            if not r["pengolah_id"]:
                raise ValueError("Belum ada pengolah yang dicocokkan untuk permintaan ini")
            status, pengolah_id, volume = "dijadwalkan", r["pengolah_id"], None
        elif aksi == "tolak":
            # Pengolah menolak: coba cocokkan ke pengolah lain sebelum menyerah.
            lain = cocokkan(db, r["wilayah_id"], r["jenis"], r["perkiraan_kg"],
                            r["jadwal"], kecuali=(r["pengolah_id"],) if r["pengolah_id"] else ())
            status = "dijadwalkan" if lain else "ditolak"
            pengolah_id, volume = lain, None
        else:
            if type(volume_kg) is not int or volume_kg <= 0 or volume_kg > 1000:
                raise ValueError("volume_kg harus bilangan bulat antara 1 dan 1000")
            if not r["pengolah_id"]:
                raise ValueError("Permintaan belum dijadwalkan ke pengolah mana pun")
            status, pengolah_id, volume = "selesai", r["pengolah_id"], volume_kg

        db.execute(
            "UPDATE permintaan SET status = ?, pengolah_id = ?, volume_kg = ?, diperbarui_pada = ?"
            " WHERE id = ?",
            (status, pengolah_id, volume, sekarang(), permintaan_id),
        )
        hasil = db.execute("SELECT * FROM permintaan WHERE id = ?", (permintaan_id,)).fetchone()
    return bentuk(hasil)


# --- Konteks Analitik dan Pelaporan ------------------------------------------

def rekap(wilayah_id=None, jenis=None, dari=None, sampai=None):
    """Rekap agregat dan anonim. Tidak pernah memuat penghasil_ref maupun id
    permintaan, sesuai batasan berbagi data pada Tugas 1."""
    if jenis and jenis not in JENIS_SAMPAH:
        raise ValueError(f"jenis harus salah satu dari {', '.join(JENIS_SAMPAH)}")
    for nama, nilai in (("dari", dari), ("sampai", sampai)):
        if nilai:
            try:
                date.fromisoformat(nilai)
            except ValueError:
                raise ValueError(f"{nama} harus tanggal berformat YYYY-MM-DD")
    syarat, nilai = [], []
    for kolom, isi in (("wilayah_id", wilayah_id), ("jenis", jenis)):
        if isi:
            syarat.append(f"{kolom} = ?")
            nilai.append(isi)
    if dari:
        syarat.append("jadwal >= ?")
        nilai.append(dari)
    if sampai:
        syarat.append("jadwal <= ?")
        nilai.append(sampai)
    where = (" WHERE " + " AND ".join(syarat)) if syarat else ""
    with koneksi() as db:
        baris = db.execute(
            "SELECT jenis, status, COUNT(*) AS jumlah,"
            " COALESCE(SUM(volume_kg), 0) AS terkelola_kg,"
            " COALESCE(SUM(perkiraan_kg), 0) AS diajukan_kg"
            f" FROM permintaan{where} GROUP BY jenis, status", nilai,
        ).fetchall()
    per_jenis, total = {}, {"permintaan": 0, "selesai": 0, "terkelola_kg": 0, "diajukan_kg": 0}
    for r in baris:
        j = per_jenis.setdefault(r["jenis"], {"permintaan": 0, "selesai": 0, "terkelola_kg": 0})
        j["permintaan"] += r["jumlah"]
        j["terkelola_kg"] += r["terkelola_kg"]
        total["permintaan"] += r["jumlah"]
        total["diajukan_kg"] += r["diajukan_kg"]
        total["terkelola_kg"] += r["terkelola_kg"]
        if r["status"] == "selesai":
            j["selesai"] += r["jumlah"]
            total["selesai"] += r["jumlah"]
    return {
        "saringan": {"wilayah_id": wilayah_id, "jenis": jenis, "dari": dari, "sampai": sampai},
        "total": total,
        "per_jenis": per_jenis,
        "sumber": "agregat_anonim",
    }


class Api(BaseHTTPRequestHandler):
    def diizinkan(self, path):
        if not API_KEY or path in TANPA_KUNCI:
            return True
        return hmac.compare_digest(self.headers.get("X-API-Key", ""), API_KEY)

    def lintas_asal(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.send_header("Access-Control-Max-Age", "86400")

    def kirim(self, kode, isi):
        data = json.dumps(isi, ensure_ascii=False).encode()
        self.send_response(kode)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.lintas_asal()
        self.end_headers()
        self.wfile.write(data)

    def badan(self):
        panjang = int(self.headers.get("Content-Length", "0"))
        if panjang <= 0 or panjang > 65536:
            raise ValueError("Ukuran request tidak valid")
        isi = json.loads(self.rfile.read(panjang))
        if not isinstance(isi, dict):
            raise ValueError("Badan request harus objek JSON")
        return isi

    def do_OPTIONS(self):
        self.send_response(204)
        self.lintas_asal()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        satu = lambda nama: q.get(nama, [None])[0]
        if not self.diizinkan(url.path):
            return self.kirim(401, {"galat": "API key tidak valid atau belum disertakan"})
        try:
            if url.path == "/api/health":
                return self.kirim(200, {"layanan": "flowganic", "status": "ok"})
            if url.path == "/api/wilayah":
                return self.kirim(200, semua_wilayah())
            if url.path == "/api/pengolah":
                return self.kirim(200, daftar_pengolah(satu("wilayah_id"), satu("jenis")))
            if url.path == "/api/rekap":
                return self.kirim(200, rekap(satu("wilayah_id"), satu("jenis"),
                                             satu("dari"), satu("sampai")))
            cocok = re.fullmatch(r"/api/permintaan/([A-Za-z0-9-]{1,40})", url.path)
            if cocok:
                return self.kirim(200, ambil_permintaan(cocok.group(1)))
        except ValueError as exc:
            return self.kirim(400, {"galat": str(exc)})
        except LookupError as exc:
            return self.kirim(404, {"galat": str(exc)})
        self.kirim(404, {"galat": "Endpoint tidak ditemukan"})

    def do_POST(self):
        url = urlparse(self.path)
        if not self.diizinkan(url.path):
            return self.kirim(401, {"galat": "API key tidak valid atau belum disertakan"})
        if url.path != "/api/permintaan":
            return self.kirim(404, {"galat": "Endpoint tidak ditemukan"})
        try:
            isi = self.badan()
            hasil = ajukan_permintaan(
                isi.get("penghasil_ref"), isi.get("wilayah_id"), isi.get("jenis"),
                isi.get("perkiraan_kg"), isi.get("jadwal"),
            )
            return self.kirim(200 if hasil["duplikat"] else 201, hasil)
        except LookupError as exc:
            return self.kirim(404, {"galat": str(exc)})
        except (ValueError, TypeError, UnicodeError) as exc:
            return self.kirim(400, {"galat": str(exc)})

    def do_PATCH(self):
        url = urlparse(self.path)
        if not self.diizinkan(url.path):
            return self.kirim(401, {"galat": "API key tidak valid atau belum disertakan"})
        cocok = re.fullmatch(r"/api/permintaan/([A-Za-z0-9-]{1,40})", url.path)
        if not cocok:
            return self.kirim(404, {"galat": "Endpoint tidak ditemukan"})
        try:
            isi = self.badan()
            return self.kirim(200, perbarui_permintaan(
                cocok.group(1), isi.get("aksi"), isi.get("volume_kg")))
        except LookupError as exc:
            return self.kirim(404, {"galat": str(exc)})
        except (ValueError, TypeError, UnicodeError) as exc:
            return self.kirim(400, {"galat": str(exc)})


if __name__ == "__main__":
    siapkan_data()
    ThreadingHTTPServer(("0.0.0.0", 8000), Api).serve_forever()

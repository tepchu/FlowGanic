import os
import tempfile
import unittest
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import app


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

    def test_rute_antarmoda(self):
        rute = app.rencanakan_rute("blok-m", "manggarai")
        self.assertEqual([x["moda"] for x in rute["langkah"]], ["MRT", "JALAN_KAKI", "KRL"])
        self.assertEqual(rute["total_menit"], 39)

    def test_eta_jadwal_contoh(self):
        waktu = datetime(2026, 11, 19, 8, 1, tzinfo=ZoneInfo("Asia/Jakarta"))
        eta = app.prediksi_eta("blok-m", waktu)
        self.assertEqual(eta["prediksi"][0]["menit_menunggu"], 5)
        self.assertEqual(eta["sumber"], "jadwal_contoh")

    def test_risiko_transfer(self):
        self.assertEqual(app.risiko_transfer(4, 5)["tingkat"], "tinggi")
        self.assertEqual(app.risiko_transfer(12, 5)["tingkat"], "rendah")
        with self.assertRaises(ValueError):
            app.risiko_transfer(-1, 5)
        with self.assertRaises(ValueError):
            app.risiko_transfer(True, 5)

    def test_http(self):
        handler = self.handler()
        for path, kode in [("/api/health", 200), ("/api/rute?asal=blok-m&tujuan=manggarai", 200), ("/api/rute?asal=unknown&tujuan=manggarai", 404), ("/api/eta", 400)]:
            handler.path = path
            handler.do_GET()
            self.assertEqual(self.hasil.pop()[0], kode)
        for payload, kode in [(b'{"sisa_menit":4,"waktu_jalan_menit":5}', 200), (b'{"sisa_menit":true,"waktu_jalan_menit":5}', 400), (b'\xff', 400)]:
            handler.path = "/api/risiko-transfer"
            handler.headers = {"Content-Length": str(len(payload))}
            handler.rfile = BytesIO(payload)
            handler.do_POST()
            self.assertEqual(self.hasil.pop()[0], kode)

    def test_api_key(self):
        app.API_KEY = "kunci-uji"
        handler = self.handler()

        handler.path = "/api/health"
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 200)

        handler.path = "/api/halte"
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 401)

        handler.headers = {"X-API-Key": "salah"}
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 401)

        handler.headers = {"X-API-Key": "kunci-uji"}
        handler.do_GET()
        self.assertEqual(self.hasil.pop()[0], 200)

        payload = b'{"sisa_menit":4,"waktu_jalan_menit":5}'
        handler.path = "/api/risiko-transfer"
        handler.headers = {}
        handler.do_POST()
        self.assertEqual(self.hasil.pop()[0], 401)

        handler.headers = {"X-API-Key": "kunci-uji", "Content-Length": str(len(payload))}
        handler.rfile = BytesIO(payload)
        handler.do_POST()
        self.assertEqual(self.hasil.pop()[0], 200)


if __name__ == "__main__":
    unittest.main()

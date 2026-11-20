import heapq
import hmac
import itertools
import json
import os
import sqlite3
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo


DB_PATH = os.environ.get("DB_PATH", "/tmp/flowganic.db")
API_KEY = os.environ.get("API_KEY", "")
TANPA_KUNCI = {"/api/health"}
ZONA = ZoneInfo("Asia/Jakarta")
HALTE = [
    ("blok-m", "Blok M", -6.244, 106.799),
    ("bundaran-hi", "Bundaran HI", -6.194, 106.823),
    ("dukuh-atas", "Dukuh Atas BNI", -6.200, 106.822),
    ("sudirman", "Sudirman", -6.202, 106.823),
    ("manggarai", "Manggarai", -6.210, 106.850),
    ("harmoni", "Harmoni", -6.167, 106.820),
    ("monas", "Monas", -6.176, 106.827),
]
RUAS = [
    ("blok-m", "dukuh-atas", "MRT", 18, 6),
    ("dukuh-atas", "bundaran-hi", "MRT", 5, 6),
    ("dukuh-atas", "sudirman", "JALAN_KAKI", 5, 0),
    ("sudirman", "manggarai", "KRL", 8, 10),
    ("bundaran-hi", "monas", "TRANSJAKARTA", 12, 10),
    ("monas", "harmoni", "TRANSJAKARTA", 8, 10),
]


def koneksi():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def siapkan_data():
    with koneksi() as db:
        db.execute("CREATE TABLE IF NOT EXISTS halte (id TEXT PRIMARY KEY, nama TEXT, latitude REAL, longitude REAL)")
        db.execute("CREATE TABLE IF NOT EXISTS ruas (asal TEXT, tujuan TEXT, moda TEXT, menit INTEGER, interval_menit INTEGER, PRIMARY KEY (asal, tujuan, moda))")
        db.executemany("INSERT OR IGNORE INTO halte VALUES (?, ?, ?, ?)", HALTE)
        for asal, tujuan, moda, menit, interval in RUAS:
            db.execute("INSERT OR IGNORE INTO ruas VALUES (?, ?, ?, ?, ?)", (asal, tujuan, moda, menit, interval))
            db.execute("INSERT OR IGNORE INTO ruas VALUES (?, ?, ?, ?, ?)", (tujuan, asal, moda, menit, interval))


def semua_halte():
    with koneksi() as db:
        return [dict(row) for row in db.execute("SELECT * FROM halte ORDER BY nama")]


def prediksi_eta(halte_id, waktu=None):
    waktu = waktu or datetime.now(ZONA)
    with koneksi() as db:
        ada = db.execute("SELECT 1 FROM halte WHERE id = ?", (halte_id,)).fetchone()
        if not ada:
            raise LookupError("Halte tidak ditemukan")
        ruas = db.execute("SELECT DISTINCT moda, interval_menit FROM ruas WHERE asal = ? AND moda != 'JALAN_KAKI' ORDER BY moda", (halte_id,)).fetchall()
    menit_sekarang = waktu.hour * 60 + waktu.minute
    return {
        "halte_id": halte_id,
        "prediksi": [
            {"moda": row["moda"], "menit_menunggu": (row["interval_menit"] - menit_sekarang % row["interval_menit"]) % row["interval_menit"]}
            for row in ruas
        ],
        "sumber": "jadwal_contoh",
        "diperbarui_pada": waktu.isoformat(),
    }


def risiko_transfer(sisa_menit, waktu_jalan_menit):
    if type(sisa_menit) is not int or type(waktu_jalan_menit) is not int or min(sisa_menit, waktu_jalan_menit) < 0:
        raise ValueError("sisa_menit dan waktu_jalan_menit harus bilangan bulat nonnegatif")
    jeda = sisa_menit - waktu_jalan_menit
    tingkat = "tinggi" if jeda < 3 else "sedang" if jeda < 7 else "rendah"
    return {"jeda_menit": jeda, "tingkat": tingkat, "metode": "aturan_jeda"}


def rencanakan_rute(asal, tujuan):
    with koneksi() as db:
        ids = {row[0] for row in db.execute("SELECT id FROM halte")}
        if asal not in ids or tujuan not in ids:
            raise LookupError("Halte asal atau tujuan tidak ditemukan")
        ruas = [dict(row) for row in db.execute("SELECT * FROM ruas")]
    tetangga = {}
    for row in ruas:
        tetangga.setdefault(row["asal"], []).append(row)
    urutan = itertools.count()
    antrean = [(0, next(urutan), asal, None, [])]
    terbaik = {}
    while antrean:
        total, _, posisi, moda_sebelumnya, langkah = heapq.heappop(antrean)
        kunci = (posisi, moda_sebelumnya)
        if total > terbaik.get(kunci, float("inf")):
            continue
        if posisi == tujuan:
            return {"asal": asal, "tujuan": tujuan, "total_menit": total, "langkah": langkah, "sumber": "jaringan_contoh"}
        for ruas in tetangga.get(posisi, []):
            moda = ruas["moda"]
            tunggu = 0 if moda in ("JALAN_KAKI", moda_sebelumnya) else (ruas["interval_menit"] + 1) // 2
            berikut = total + ruas["menit"] + tunggu
            kunci_baru = (ruas["tujuan"], moda)
            if berikut < terbaik.get(kunci_baru, float("inf")):
                terbaik[kunci_baru] = berikut
                langkah_baru = {"asal": posisi, "tujuan": ruas["tujuan"], "moda": moda, "perjalanan_menit": ruas["menit"], "menunggu_menit": tunggu}
                heapq.heappush(antrean, (berikut, next(urutan), ruas["tujuan"], moda, langkah + [langkah_baru]))
    raise LookupError("Tidak ada rute yang menghubungkan kedua halte")


class Api(BaseHTTPRequestHandler):
    def diizinkan(self, path):
        if not API_KEY or path in TANPA_KUNCI:
            return True
        return hmac.compare_digest(self.headers.get("X-API-Key", ""), API_KEY)

    def lintas_asal(self):
        # API dipakai aplikasi web dan kelompok lain dari origin berbeda.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

    def do_OPTIONS(self):
        # Preflight tidak membawa kunci, jadi tidak diperiksa di sini.
        self.send_response(204)
        self.lintas_asal()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        if not self.diizinkan(url.path):
            return self.kirim(401, {"galat": "API key tidak valid atau belum disertakan"})
        try:
            if url.path == "/api/health":
                return self.kirim(200, {"layanan": "flowganic", "status": "ok"})
            if url.path == "/api/halte":
                return self.kirim(200, {"halte": semua_halte(), "sumber": "data_contoh"})
            if url.path == "/api/eta":
                return self.kirim(200, prediksi_eta(query["halte_id"][0]))
            if url.path == "/api/rute":
                return self.kirim(200, rencanakan_rute(query["asal"][0], query["tujuan"][0]))
        except KeyError:
            return self.kirim(400, {"galat": "Parameter wajib belum diisi"})
        except LookupError as exc:
            return self.kirim(404, {"galat": str(exc)})
        self.kirim(404, {"galat": "Endpoint tidak ditemukan"})

    def do_POST(self):
        if not self.diizinkan(urlparse(self.path).path):
            return self.kirim(401, {"galat": "API key tidak valid atau belum disertakan"})
        if urlparse(self.path).path != "/api/risiko-transfer":
            return self.kirim(404, {"galat": "Endpoint tidak ditemukan"})
        try:
            panjang = int(self.headers.get("Content-Length", "0"))
            if panjang <= 0 or panjang > 65536:
                raise ValueError("Ukuran request tidak valid")
            isi = json.loads(self.rfile.read(panjang))
            hasil = risiko_transfer(isi["sisa_menit"], isi["waktu_jalan_menit"])
            return self.kirim(200, hasil)
        except (ValueError, KeyError, TypeError, UnicodeError) as exc:
            self.kirim(400, {"galat": str(exc)})


if __name__ == "__main__":
    siapkan_data()
    ThreadingHTTPServer(("0.0.0.0", 8000), Api).serve_forever()

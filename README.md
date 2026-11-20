# FlowGanic

Microservice mobilitas multimoda Jakarta untuk Tugas 2 II3160 TST × II3140 PWAM. Satu repositori memuat dua bagian: microservice di root dan aplikasi React Native (Expo) di [`mobile/`](mobile/README.md). Layanan integrasi lintas kelompok dikerjakan pada Tugas 3.

| | |
| --- | --- |
| Kelompok | `kononkatanya` (K01) |
| Base URL | **https://kononkatanya.stei.fun/api** |
| Dokumentasi interaktif | **https://kononkatanya.stei.fun/api/docs** |
| Repositori | https://github.com/tepchu/FlowGanic |
| Autentikasi | Header `X-API-Key` pada semua endpoint kecuali `/health` |

## Status implementasi

| Bagian | Status |
| --- | --- |
| API halte, rute, ETA, risiko transfer | Berjalan dengan **data contoh** |
| Docker Compose, gateway Nginx, batas CPU/memori | Berjalan dan terverifikasi di STB |
| Akses publik HTTPS via Cloudflare Tunnel | Berjalan dan terverifikasi dari luar jaringan STB |
| Autentikasi `X-API-Key` | Berjalan dan terverifikasi dari internet |
| OpenAPI, tes Python, skrip `cek-api.sh` | Tersedia |
| Aplikasi mobile Expo | Kerangka selesai, lihat [`mobile/README.md`](mobile/README.md) |
| Entri API Registry | Belum didaftarkan |
| Feed GTFS-Realtime, prediksi AI | Belum diimplementasikan |

Data contoh mencakup tujuh halte dan ruas MRT, KRL, serta Transjakarta. Rute memakai waktu perjalanan dan rata-rata waktu tunggu dari interval contoh. ETA menghitung waktu tunggu dari interval tersebut; risiko transfer memakai selisih waktu. **Hasilnya bukan informasi operasional aktual, dan tidak memakai model AI maupun feed real-time.** Setiap respons memuat label `sumber` atau `metode` agar batasan ini terlihat oleh pemakai API. LRT dan dasbor analitik ada dalam visi Tugas 1, tetapi belum tersedia di API ini.

## Arsitektur

```
Aplikasi mobile / kelompok lain
            │  HTTPS
            ▼
   Cloudflare edge  ──────────────────────────────┐
            │  tunnel terenkripsi (QUIC)          │
            ▼                                     │
┌─ STB Armbian ARM64 ────────────────────────────┐│
│  cloudflared (systemd service di host)         ││
│            │  http://127.0.0.1:80              ││
│            ▼                                   ││
│  ┌─ Docker ───────────────────────────────┐    ││
│  │  gateway (Nginx)   0,25 CPU · 64 MB    │    ││
│  │            │  http://core-service:8000 │    ││
│  │            ▼                           │    ││
│  │  core-service      0,5 CPU · 256 MB    │    ││
│  │            │                           │    ││
│  │            ▼                           │    ││
│  │  volume flowganic-data (SQLite)        │    ││
│  └────────────────────────────────────────┘    ││
└────────────────────────────────────────────────┘│
   Tidak ada port STB yang dibuka ke internet ────┘
```

| Komponen | Teknologi | Fungsi | Batas sumber daya |
| --- | --- | --- | --- |
| `core-service` | Python 3.12 standard library, SQLite | Data halte, pencarian rute, ETA, risiko transfer, pemeriksaan API key | 0,5 CPU · 256 MB |
| `gateway` | Nginx 1.28 Alpine | Meneruskan `/api/*`, menyajikan `/api/docs`, membatasi 5 req/detik per IP | 0,25 CPU · 64 MB |
| `cloudflared` | Cloudflare Tunnel | HTTPS publik tanpa membuka port | service host |

Core service dan database tidak mempublikasikan port sama sekali. Gateway hanya terikat ke `127.0.0.1` di STB, sehingga tidak terjangkau dari jaringan lokal maupun internet kecuali melalui tunnel. Semua container memakai `restart: unless-stopped` agar hidup kembali setelah listrik padam.

Gateway juga menjadi pintu depan tunggal bagi seluruh domain. Path di luar `/api` diteruskan ke aaPanel yang berjalan di host pada port 1122, mengikuti ketentuan kelas yang meminta panel dapat diakses pada `/aapanel`. Yang diteruskan adalah seluruh path non-`/api`, bukan hanya `/aapanel`, karena panel memuat aset dari path root dan akan tampil tanpa gaya bila hanya satu path yang dirutekan.

Cloudflared dijalankan sebagai service host mengikuti standar kelas, bukan sebagai container. `compose.yaml` tetap menyediakan service `tunnel` di bawah profil `public` sebagai alternatif bila tunnel ingin dijalankan dalam container; bila alternatif itu dipakai, Public Hostname harus diarahkan ke `gateway:80`, bukan `localhost`.

## Daftar endpoint

Base URL: `https://kononkatanya.stei.fun/api`. Spesifikasi mesin ada di [`openapi.yaml`](openapi.yaml)
dan disajikan pada `https://kononkatanya.stei.fun/api/openapi.yaml`.

Dokumentasi interaktif tersedia di **https://kononkatanya.stei.fun/api/docs**. Halaman itu
memuat Swagger UI: tekan **Authorize**, masukkan API key, lalu setiap endpoint dapat dicoba
langsung dari peramban lewat tombol **Try it out** tanpa perlu curl atau Postman.

| Metode | Path | Kunci | Masukan | Keluaran |
| --- | --- | --- | --- | --- |
| GET | `/health` | tidak | — | Status service |
| GET | `/halte` | ya | — | Daftar halte contoh |
| GET | `/rute` | ya | Query `asal`, `tujuan` | Langkah perjalanan dan total menit |
| GET | `/eta` | ya | Query `halte_id` | Waktu tunggu tiap moda |
| POST | `/risiko-transfer` | ya | JSON `sisa_menit`, `waktu_jalan_menit` | Jeda menit dan tingkat risiko |

Kode galat: `400` masukan wajib hilang atau tidak valid, `401` API key salah atau belum disertakan, `404` halte atau endpoint tidak ditemukan, `429` melewati batas pemanggilan.

## Cara mendapat akses

Semua endpoint kecuali `/health` memerlukan header `X-API-Key`. `/health` sengaja dibiarkan terbuka agar status layanan dan tunnel dapat diperiksa tanpa kredensial.

Kelompok lain yang ingin memakai API ini silakan menghubungi anggota kelompok untuk mendapat API key dan akun uji. Sepakati dahulu endpoint yang dipakai, format data, dan perkiraan volume pemanggilan, lalu cantumkan kesepakatan tersebut pada dokumentasi kedua kelompok. Gateway membatasi 5 request per detik per alamat IP dengan burst 20; lampaui itu dan jawabannya `429`.

Kunci tidak pernah disimpan di repositori. Nilainya hanya ada pada `.env` di STB.

## Contoh request

```sh
# Tanpa kunci: hanya health yang terbuka
curl https://kononkatanya.stei.fun/api/health

# Dengan kunci
KUNCI=<api-key-dari-kelompok>

curl -H "X-API-Key: $KUNCI" https://kononkatanya.stei.fun/api/halte

curl -H "X-API-Key: $KUNCI" \
  'https://kononkatanya.stei.fun/api/rute?asal=blok-m&tujuan=manggarai'

curl -H "X-API-Key: $KUNCI" \
  'https://kononkatanya.stei.fun/api/eta?halte_id=blok-m'

curl -X POST https://kononkatanya.stei.fun/api/risiko-transfer \
  -H "X-API-Key: $KUNCI" \
  -H 'Content-Type: application/json' \
  -d '{"sisa_menit":4,"waktu_jalan_menit":5}'
```

Contoh respons:

```json
// GET /api/health
{"layanan": "flowganic", "status": "ok"}

// GET /api/rute?asal=blok-m&tujuan=manggarai
{
  "asal": "blok-m",
  "tujuan": "manggarai",
  "total_menit": 39,
  "langkah": [
    {
      "asal": "blok-m", "tujuan": "dukuh-atas", "moda": "MRT",
      "perjalanan_menit": 18, "menunggu_menit": 3
    },
    {
      "asal": "dukuh-atas", "tujuan": "sudirman", "moda": "JALAN_KAKI",
      "perjalanan_menit": 5, "menunggu_menit": 0
    },
    {
      "asal": "sudirman", "tujuan": "manggarai", "moda": "KRL",
      "perjalanan_menit": 8, "menunggu_menit": 5
    }
  ],
  "sumber": "jaringan_contoh"
}

// POST /api/risiko-transfer  {"sisa_menit":4,"waktu_jalan_menit":5}
{"jeda_menit": -1, "tingkat": "tinggi", "metode": "aturan_jeda"}

// Tanpa X-API-Key
{"galat": "API key tidak valid atau belum disertakan"}
```

Seluruh endpoint dapat diuji sekaligus dengan skrip yang disertakan:

```sh
API_KEY=<kunci> sh cek-api.sh https://kononkatanya.stei.fun/api
```

## Struktur repo

| Path | Isi |
| --- | --- |
| `core-service/app.py` | Implementasi API, data contoh, pemeriksaan API key |
| `core-service/test_app.py` | Tes domain, handler HTTP, dan autentikasi |
| `core-service/Dockerfile` | Image backend ARM64, berjalan sebagai pengguna non-root |
| `gateway/nginx.conf` | Reverse proxy dan rate limit |
| `compose.yaml` | Core service, gateway, tunnel opsional |
| `openapi.yaml` | Kontrak lima endpoint |
| `cek-api.sh` | Skrip uji delapan pemeriksaan HTTP |
| `mobile/` | Aplikasi React Native (Expo) untuk PWAM |
| `.env.example` | Nama variabel rahasia tanpa nilainya |

## Jalankan di laptop

Syarat: Docker Engine dan Docker Compose.

```sh
cp .env.example .env     # isi API_KEY bila ingin menguji autentikasi
docker compose up -d --build
docker compose ps
sh cek-api.sh
```

Tes tanpa Docker:

```sh
cd core-service
python3 -m unittest -v
```

## Deploy ke STB

1. STB Armbian ARM64 dengan Docker dan Compose. Periksa dahulu port yang masih bebas, karena satu STB dapat menampung deployment lain:

   ```sh
   docker ps --format '{{.Names}}\t{{.Ports}}'
   ss -tlnp
   ```

2. Clone repo, lalu buat `.env`. Kunci dibuat di STB dan tidak pernah masuk Git:

   ```sh
   printf 'GATEWAY_PORT=80\nAPI_KEY=%s\n' "$(openssl rand -hex 24)" > .env
   chmod 600 .env
   docker compose up -d --build
   ```

3. Pastikan batas sumber daya benar-benar berlaku di kernel STB:

   ```sh
   docker inspect flowganic-core-service-1 flowganic-gateway-1 \
     --format '{{.Name}} {{.HostConfig.NanoCpus}} {{.HostConfig.Memory}}'
   ```

   Harus mengembalikan `CPU=500000000 MEM=268435456` dan `CPU=250000000 MEM=67108864`. Bila `MEM=0`, kernel STB belum mengaktifkan memory cgroup.

4. Pasang cloudflared dengan token tunnel dari asisten kelas:

   ```sh
   curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
   echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
   apt-get update; apt-get install -y cloudflared
   cloudflared service install <TOKEN>
   systemctl status cloudflared --no-pager
   ```

   Public Hostname diatur bertipe `HTTP` ke `localhost:80`, sesuai `GATEWAY_PORT`.

5. Verifikasi dari luar jaringan STB:

   ```sh
   sh cek-api.sh https://kononkatanya.stei.fun/api
   ```

Bila tunnel inactive, periksa koneksi STB dan token. Bila `502`, periksa URL Public Hostname dan status container. Bila `404` pada `/api/*`, besar kemungkinan Public Hostname menunjuk layanan lain di STB yang sama.

## Perawatan

```sh
docker compose logs core-service --tail 50
systemctl status cloudflared --no-pager
docker stats --no-stream
docker compose cp core-service:/data/flowganic.db ./backup-$(date +%F).db
```

Backup sebaiknya diambil saat layanan dihentikan agar salinannya konsisten, dan disimpan di luar repositori.

## Pemeriksaan yang sudah dilakukan

Per 20 November 2026:

| Pemeriksaan | Hasil |
| --- | --- |
| `python3 -m unittest` | 5 tes lulus |
| `docker compose config` | Valid |
| Batas CPU/memori di STB | `500000000`/`268435456` dan `250000000`/`67108864` |
| `cek-api.sh` terhadap URL publik dengan kunci | 8 dari 8 lulus |
| `GET /api/health` dari luar jaringan STB | `200`, HTTP/2 over TLS |
| Endpoint berkunci tanpa `X-API-Key` dari internet | `401` pada halte, rute, eta, risiko-transfer |
| `GET /` dari internet | `404` dari gateway |

Belum diuji: beban bersamaan, perilaku setelah listrik STB padam, dan tampilan aplikasi mobile di perangkat sungguhan.

## Pengumpulan

Tugas 2 meminta URL microservice publik, URL repositori, dan `README.pdf` berisi arsitektur, daftar endpoint, cara mendapat akses, serta contoh request. Milestone Base URL dan dokumentasi di API Registry: akhir Minggu 14 (29 November 2026). Pengumpulan akhir: 13 Desember 2026, 23.59 WIB.

Jangan mengunggah `.env`, database lokal, cache, atau direktori `ponytail-main`.

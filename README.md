# FlowGanic

Microservice mobilitas multimoda Jakarta untuk Tugas 2 II3160 TST × II3140 PWAM. Backend berjalan dalam Docker di STB, diakses melalui gateway Nginx dan Cloudflare Tunnel. Satu repositori memuat dua bagian: microservice di root dan aplikasi React Native (Expo) di [`mobile/`](mobile/README.md). Layanan integrasi lintas kelompok dikerjakan pada Tugas 3.

## Status implementasi

| Bagian | Status |
| --- | --- |
| API halte, rute, ETA, risiko transfer | Berjalan dengan **data contoh** |
| SQLite, Docker Compose, gateway Nginx | Berjalan dan teruji di laptop |
| Autentikasi `X-API-Key` | Terimplementasi dan teruji di laptop (komponen bonus TST) |
| OpenAPI, tes Python, skrip `cek-api.sh` | Tersedia |
| Deploy STB, URL HTTPS, API Registry | Menunggu perangkat dan token tunnel dari asisten |
| Aplikasi mobile Expo (navigasi, login, ApiService) | Kerangka selesai, lihat `mobile/README.md` |
| Feed GTFS-Realtime, prediksi AI | Belum diimplementasikan |

Data contoh mencakup tujuh halte dan ruas MRT, KRL, serta Transjakarta. Rute memakai waktu perjalanan dan rata-rata waktu tunggu dari interval contoh. ETA menghitung waktu tunggu dari interval tersebut; risiko transfer memakai selisih waktu. **Hasilnya bukan informasi operasional aktual, dan tidak memakai model AI maupun feed real-time.** LRT dan dasbor analitik ada dalam visi Tugas 1, tetapi belum tersedia di API ini.

## Arsitektur dan stack

| Komponen | Teknologi | Fungsi |
| --- | --- | --- |
| `core-service` | Python 3.12 standard library, SQLite | Data halte, pencarian rute, ETA, risiko transfer, pemeriksaan API key |
| `gateway` | Nginx 1.28 Alpine | Meneruskan `/api/*` dan membatasi request |
| `tunnel` | Cloudflared | Membuka akses HTTPS ke `gateway:80` tanpa port forwarding |
| Compose | Docker Compose | Jaringan internal, volume data, batas CPU/memori, restart |

Alur request: pengguna/API kelompok lain → Cloudflare Tunnel → Nginx → core service → SQLite. Service dan database tidak mempublikasikan port. Gateway hanya membuka `127.0.0.1:8080` untuk uji lokal di host. Container tunnel tidak dijalankan saat tes lokal tanpa profil `public`.

Batas sumber daya per container (syarat Tugas 2): `core-service` 0,5 CPU dan 256 MB, `gateway` 0,25 CPU dan 64 MB, `tunnel` 0,25 CPU dan 128 MB. Semuanya memakai `restart: unless-stopped` agar hidup kembali setelah listrik padam.

## Struktur repo

| Path | Isi |
| --- | --- |
| `core-service/app.py` | Implementasi API dan data contoh |
| `core-service/test_app.py` | Tes domain, handler HTTP, dan API key |
| `core-service/Dockerfile` | Image backend ARM64 |
| `gateway/nginx.conf` | Reverse proxy dan rate limit |
| `compose.yaml` | Core service, gateway, tunnel |
| `openapi.yaml` | Kontrak lima endpoint |
| `cek-api.sh` | Skrip uji delapan pemeriksaan HTTP |
| `mobile/` | Aplikasi React Native (Expo) untuk PWAM, lihat [`mobile/README.md`](mobile/README.md) |
| `.env.example` | Nama variabel rahasia tanpa nilainya |

## Jalankan dan uji di laptop

Syarat: Docker Engine dan Docker Compose. Dari root repo:

```sh
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8080/api/health
```

Health yang berhasil: `{"layanan": "flowganic", "status": "ok"}`. Lima request contoh:

```sh
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/halte
curl 'http://127.0.0.1:8080/api/rute?asal=blok-m&tujuan=manggarai'
curl 'http://127.0.0.1:8080/api/eta?halte_id=blok-m'
curl -X POST http://127.0.0.1:8080/api/risiko-transfer \
  -H 'Content-Type: application/json' \
  -d '{"sisa_menit":4,"waktu_jalan_menit":5}'
```

Bila `API_KEY` sudah diisi pada `.env`, tambahkan `-H 'X-API-Key: <kunci>'` pada semua request kecuali `/api/health`.

Port host gateway dapat diubah lewat `GATEWAY_PORT` pada `.env` bila 8080 sudah dipakai proses lain. Port ini hanya untuk uji lokal; tunnel menjangkau `gateway:80` melalui jaringan internal Docker, jadi layanan publik tidak bergantung padanya.

Rute contoh Blok M → Manggarai menghasilkan 39 menit melalui MRT → jalan kaki → KRL. Request risiko contoh menghasilkan jeda -1 menit dan tingkat `tinggi`. Semua respons JSON memuat label sumber/metode agar data contoh tidak disalahartikan.

Uji seluruh endpoint sekaligus, termasuk kasus galat:

```sh
sh cek-api.sh                                    # gateway lokal
API_KEY=<kunci> sh cek-api.sh                    # bila API key aktif
sh cek-api.sh https://flowganic.stei.fun/api     # setelah tunnel aktif
```

Tes tanpa Docker:

```sh
cd core-service
python3 -m unittest -v
```

Lima tes lulus pada 20 November 2026. Delapan pemeriksaan `cek-api.sh` juga lulus melalui gateway lokal: lima endpoint mengembalikan 200, masukan hilang/tidak valid menghasilkan 400, serta halte dan endpoint tidak dikenal menghasilkan 404. Dengan `API_KEY` aktif, request tanpa kunci atau dengan kunci salah menghasilkan 401 sedangkan `/api/health` tetap 200. Uji publik dan STB belum dilakukan.

## Kontrak API

Base URL lokal: `http://127.0.0.1:8080/api`. Base URL publik ditetapkan setelah tunnel aktif. Spesifikasi lengkap ada di [`openapi.yaml`](openapi.yaml).

| Metode | Path | Masukan | Keluaran |
| --- | --- | --- | --- |
| GET | `/health` | — | Status service |
| GET | `/halte` | — | Daftar halte contoh |
| GET | `/rute` | Query `asal`, `tujuan` | Langkah dan total perjalanan |
| GET | `/eta` | Query `halte_id` | Waktu tunggu tiap moda |
| POST | `/risiko-transfer` | JSON `sisa_menit`, `waktu_jalan_menit` | Jeda dan tingkat risiko |

ID halte tersedia dari `GET /halte`.

### Cara mendapat akses

Semua endpoint kecuali `/health` memerlukan header `X-API-Key`. `/health` sengaja dibiarkan terbuka agar status tunnel dan container dapat diperiksa tanpa kredensial.

```sh
curl -H 'X-API-Key: <kunci>' https://flowganic.stei.fun/api/halte
```

Kunci yang salah atau tidak disertakan menghasilkan `401` dengan badan `{"galat": "API key tidak valid atau belum disertakan"}`. Bila variabel `API_KEY` tidak diisi, pemeriksaan kunci mati dan seluruh endpoint terbuka — pengaturan ini hanya untuk pengembangan lokal, jangan dipakai saat layanan sudah publik.

Kelompok lain yang ingin memakai API ini: hubungi anggota kelompok untuk mendapat kunci dan akun uji. Sepakati dahulu endpoint yang dipakai, format data, dan batas pemanggilan, lalu cantumkan kesepakatan itu pada dokumentasi kedua kelompok. Gateway membatasi 5 request per detik per alamat IP dengan burst 20.

## Deploy ke STB dan tunneling

1. Siapkan STB ARM64 dengan Armbian, koneksi internet/SSH, Docker dan Compose. Periksa lebih dulu apakah port 8080 di STB masih bebas, karena satu STB dapat menampung deployment kelompok lain:

   ```sh
   docker ps --format '{{.Names}}\t{{.Ports}}'
   ss -tlnp | grep -E ':(8080|8081)'
   ```

   Bila 8080 terpakai, isi `GATEWAY_PORT` pada `.env` dengan port bebas. Clone repo, jalankan `docker compose up -d --build`, lalu uji `sh cek-api.sh http://127.0.0.1:<port>/api` **di STB**.
2. Pastikan batas sumber daya benar-benar terpasang di STB:

   ```sh
   docker inspect flowganic-core-service-1 flowganic-gateway-1 \
     --format '{{.Name}} CPU={{.HostConfig.NanoCpus}} MEM={{.HostConfig.Memory}}'
   docker stats --no-stream
   ```

   Bila `MEM=0` atau `docker info` memuat peringatan memory limit, kernel STB belum mengaktifkan memory cgroup dan perlu diperbaiki lebih dulu.
3. Nama `flowganic` dipesan di API Registry dan tunnel dibuat oleh asisten kelas; token diberikan kepada kelompok untuk disalin. Public hostname harus bertipe `HTTP` dengan URL `gateway:80` — bukan `localhost:80`, karena cloudflared berjalan pada container terpisah. Domain mengikuti kelas: K01 `flowganic.stei.fun`, K02 `flowganic.stei.site`.
4. Salin `.env.example` menjadi `.env` di STB, isi `TUNNEL_TOKEN` dari asisten dan `API_KEY` hasil `openssl rand -hex 24`, lalu `chmod 600 .env`. Jalankan `docker compose --profile public up -d --build`. Jangan memasukkan token atau kunci ke Git maupun chat publik.
5. Cek `docker compose ps`, `docker compose logs tunnel --tail 30`, dan `sh cek-api.sh https://<domain-kelompok>/api` dari jaringan luar.

Jika tunnel inactive, periksa STB, koneksi, dan token. Jika 502, periksa `gateway:80` dan status container. Jangan membuka port database atau menjalankan frontend/model AI di STB. Gunakan data uji, bukan data pribadi asli.

## Perawatan

Backup database SQLite secara berkala, idealnya saat layanan dihentikan agar salinan konsisten. Simpan hasilnya di luar repo:

```sh
docker compose cp core-service:/data/flowganic.db ./backup-$(date +%F).db
```

Pantau beban STB dengan `docker stats` dan `free -h`. Lihat log dengan `docker compose logs core-service --tail 50`.

## Pengumpulan

Tugas 2 meminta URL microservice publik, URL repositori, dan `README.pdf` berisi arsitektur, daftar endpoint, cara mendapat akses, serta contoh request. Ekspor README ini ke PDF setelah URL HTTPS yang **benar-benar teruji** ditambahkan. Milestone URL dan dokumentasi di API Registry: akhir Minggu 14 (29 November 2026). Pengumpulan akhir: 13 Desember 2026, 23.59 WIB.

Jangan ikut mengunggah `.env`, database lokal, cache, atau direktori `ponytail-main`.

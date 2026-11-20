# FlowGanic API

Microservice mobilitas multimoda Jakarta untuk Tugas 2 II3160 TST × II3140 PWAM. Backend berjalan dalam Docker di STB, diakses melalui gateway Nginx dan Cloudflare Tunnel. Aplikasi mobile dan layanan integrasi lintas kelompok dikerjakan pada tahap berikutnya.

## Status implementasi

| Bagian | Status |
| --- | --- |
| API halte, rute, ETA, risiko transfer | Berjalan dengan **data contoh** |
| SQLite, Docker Compose, gateway Nginx | Berjalan dan teruji di laptop |
| OpenAPI dan tes Python | Tersedia |
| Deploy STB, URL HTTPS, API Registry | Menunggu perangkat dan akses kelas |
| Feed GTFS-Realtime, prediksi AI | Belum diimplementasikan |

Data contoh mencakup tujuh halte dan ruas MRT, KRL, serta Transjakarta. Rute memakai waktu perjalanan dan rata-rata waktu tunggu dari interval contoh. ETA menghitung waktu tunggu dari interval tersebut; risiko transfer memakai selisih waktu. **Hasilnya bukan informasi operasional aktual.** LRT dan dasbor analitik ada dalam visi Tugas 1, tetapi belum tersedia di API ini.

## Arsitektur dan stack

| Komponen | Teknologi | Fungsi |
| --- | --- | --- |
| `core-service` | Python 3.12 standard library, SQLite | Data halte, pencarian rute, ETA, risiko transfer |
| `gateway` | Nginx 1.28 Alpine | Meneruskan `/api/*` dan membatasi request |
| `tunnel` | Cloudflared | Membuka akses HTTPS ke `gateway:80` tanpa port forwarding |
| Compose | Docker Compose | Jaringan internal, volume data, batas CPU/memori, restart |

Alur request: pengguna/API kelompok lain → Cloudflare Tunnel → Nginx → core service → SQLite. Service dan database tidak mempublikasikan port. Gateway hanya membuka `127.0.0.1:8080` untuk uji lokal di host. Container tunnel tidak dijalankan saat tes lokal tanpa profil `public`.

## Struktur repo

| Path | Isi |
| --- | --- |
| `core-service/app.py` | Implementasi API dan data contoh |
| `core-service/test_app.py` | Tes domain dan handler HTTP |
| `core-service/Dockerfile` | Image backend ARM64 |
| `gateway/nginx.conf` | Reverse proxy dan rate limit |
| `compose.yaml` | Core service, gateway, tunnel |
| `openapi.yaml` | Kontrak lima endpoint |
| `.env.example` | Nama variabel token tanpa nilainya |

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

Rute contoh Blok M → Manggarai menghasilkan 39 menit melalui MRT → jalan kaki → KRL. Request risiko contoh menghasilkan jeda -1 menit dan tingkat `tinggi`. Semua respons JSON memuat label sumber/metode agar data contoh tidak disalahartikan.

Tes tanpa Docker:

```sh
cd core-service
python3 -m unittest -v
```

Empat tes lulus pada 19 November 2026. Lima endpoint juga merespons HTTP 200 melalui gateway lokal; masukan hilang/tidak valid menghasilkan 400 dan halte tidak dikenal 404. Uji publik dan STB belum dilakukan.

## Kontrak API

Base URL lokal: `http://127.0.0.1:8080/api`. Base URL publik ditetapkan setelah tunnel aktif. Spesifikasi lengkap ada di [`openapi.yaml`](openapi.yaml).

| Metode | Path | Masukan | Keluaran |
| --- | --- | --- | --- |
| GET | `/health` | — | Status service |
| GET | `/halte` | — | Daftar halte contoh |
| GET | `/rute` | Query `asal`, `tujuan` | Langkah dan total perjalanan |
| GET | `/eta` | Query `halte_id` | Waktu tunggu tiap moda |
| POST | `/risiko-transfer` | JSON `sisa_menit`, `waktu_jalan_menit` | Jeda dan tingkat risiko |

ID halte tersedia dari `GET /halte`. Belum ada autentikasi; autentikasi/otorisasi merupakan bonus TST. Sebelum kelompok lain memakai API, sepakati endpoint, format data, batas request, dan kontak, lalu cantumkan pada dokumentasi kedua kelompok.

## Deploy ke STB dan tunneling

1. Siapkan STB ARM64 dengan Armbian, koneksi internet/SSH, Docker dan Compose. Clone repo, jalankan `docker compose up -d --build`, lalu uji `curl http://127.0.0.1:8080/api/health` **di STB**.
2. Pastikan kelas K01/K02 dan pesan nama `flowganic` di API Registry. K01 memakai `flowganic.stei.fun`; K02 memakai `flowganic.stei.site`. Kedua URL ini masih **rencana**, belum terdaftar atau teruji.
3. Dengan akses akun Cloudflare kelas, buat tunnel milik kelompok. Public hostname: subdomain `flowganic`, domain sesuai kelas, service Type `HTTP`, URL `gateway:80`.
4. Salin `.env.example` menjadi `.env`, isi `TUNNEL_TOKEN` lokal, lalu jalankan `docker compose --profile public up -d --build`. Jangan masukkan token ke Git atau chat publik.
5. Cek `docker compose ps`, `docker compose logs tunnel --tail 30`, dan `curl https://<domain-kelompok>/api/health` dari jaringan luar. Setelah HTTPS dan endpoint berfungsi, masukkan base URL serta dokumentasi ke Registry.

Jika tunnel inactive, periksa STB, koneksi, dan token. Jika 502, periksa `gateway:80` dan status container. Jangan membuka port database atau menjalankan frontend/model AI di STB. Gunakan data uji, bukan data pribadi asli.

## Pengumpulan

Tugas 2 meminta URL microservice publik, URL repositori, dan `README.pdf` berisi arsitektur, endpoint, cara akses, serta contoh request. Ekspor README ini ke PDF setelah URL GitHub dan HTTPS yang **benar-benar teruji** ditambahkan. Milestone URL dan dokumentasi di API Registry: akhir Minggu 14 (29 November 2026). Pengumpulan akhir: 13 Desember 2026, 23.59 WIB.

Jangan ikut mengunggah `.env`, database lokal, cache, atau direktori `ponytail-main`.


# FlowGanic Mobile

Aplikasi React Native (Expo) untuk II3140 PWAM. Mengonsumsi microservice FlowGanic pada repo yang sama (`../core-service`) dan disiapkan untuk memanggil API kelompok lain pada Tugas 3.

## Status

| Bagian | Status |
| --- | --- |
| Navigasi stack + tab, enam layar | Selesai |
| Login dan form dengan validasi | Selesai, login masih diverifikasi di perangkat |
| `src/api/ApiService.js` ke microservice sendiri | Selesai dan teruji terhadap gateway lokal |
| Panggilan ke API ≥ 2 kelompok lain | Kerangka siap, base URL menunggu API Registry |
| Branding, aset, build APK release | Belum dikerjakan |

## Menjalankan

Syarat: Node.js 22 dan npm. Microservice harus hidup lebih dulu (`docker compose up -d --build` dari root repo).

```sh
cd mobile
npm install
cp .env.example .env     # sesuaikan EXPO_PUBLIC_API_URL
npx expo start
```

Tekan `w` untuk membuka di peramban, `a` untuk emulator Android, atau pindai kode QR dengan Expo Go.

Bila aplikasi dijalankan di perangkat fisik, `127.0.0.1` menunjuk ke perangkat itu sendiri. Isi `EXPO_PUBLIC_API_URL` dengan alamat IP laptop di jaringan yang sama, misalnya `http://192.168.1.10:8080/api`, atau dengan URL publik setelah tunnel aktif.

### Akun demo

| Surel | Kata sandi |
| --- | --- |
| `demo@flowganic.id` | `flowganic24` |

Login diverifikasi di perangkat terhadap akun demo di atas, lalu sesi disimpan pada AsyncStorage. Microservice FlowGanic baru menyediakan API key antarlayanan, belum endpoint autentikasi pengguna, jadi belum ada token dari server. Ini dicatat terbuka di layar Masuk agar tidak disalahartikan sebagai autentikasi nyata.

## Variabel lingkungan

Semua lewat `.env`, tidak ada nilai rahasia di dalam kode. Lihat `.env.example`.

| Variabel | Isi |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL microservice FlowGanic, berakhiran `/api` |
| `EXPO_PUBLIC_API_KEY` | API key FlowGanic; dikirim sebagai header `X-API-Key` |
| `EXPO_PUBLIC_MITRA1_*` | Nama, base URL, dan kunci kelompok mitra pertama |
| `EXPO_PUBLIC_MITRA2_*` | Nama, base URL, dan kunci kelompok mitra kedua |

## Struktur

| Path | Isi |
| --- | --- |
| `App.js` | Navigasi: stack luar untuk Masuk dan DetailHalte, tab untuk empat layar utama |
| `src/api/ApiService.js` | Satu pintu pemanggilan HTTP, API FlowGanic, dan kerangka mitra |
| `src/api/konfigurasi.js` | Base URL, API key, akun demo |
| `src/konteks/SesiContext.js` | Status login dan penyimpanan sesi |
| `src/layar/` | Masuk, Halte, DetailHalte, Rute, Risiko, Profil |
| `src/ui/responsif.js` | Titik ubah mobile first |
| `src/ui/komponen.js` | Wadah, Kartu, Kolom, Tombol, Pesan, Lencana |
| `src/ui/tema.js` | Warna dan jarak |

## Pendekatan mobile first

Gaya dasar ditulis untuk layar ponsel paling sempit, tanpa asumsi ruang lebih. Penyesuaian hanya ditambahkan ketika lebar layar **mencapai minimum** tertentu, sejalan dengan pola `min-width`:

| Titik ubah | Lebar minimum | Penyesuaian |
| --- | --- | --- |
| dasar | 0 | Satu kolom, padding 16, daftar halte satu per baris |
| sedang | 600 | Lebar konten dibatasi 680, padding 24, daftar halte dua kolom, judul membesar |
| lebar | 900 | Lebar konten dibatasi 900 |

Di React Native tidak ada media query CSS, jadi titik ubah dibaca lewat `useWindowDimensions` pada `src/ui/responsif.js`. Helper `perLebar({ dasar, sedang, lebar }, r)` selalu mewajibkan nilai `dasar` dan hanya menimpanya bila ambang tercapai, sehingga tata letak ponsel adalah jalur bawaan, bukan hasil penyusutan dari tata letak lebar.

Target sentuh tombol dan kolom isian dijaga minimal 48 pt, dan semua layar memakai `ScrollView` atau `FlatList` agar tetap terpakai pada layar pendek dengan papan ketik terbuka.

## Pemeriksaan yang sudah dilakukan

Pada 20 November 2026, terhadap gateway lokal `http://127.0.0.1:8080/api`:

- `npx expo export --platform android` berhasil, 868 modul, tanpa galat.
- `npx expo export --platform web` berhasil.
- `ApiService.js` diuji langsung terhadap microservice yang hidup: `cekKesehatan` mengembalikan `flowganic/ok`, `ambilHalte` 7 halte, `cariRute` 39 menit dalam 3 langkah, `ambilEta` 1 moda, `hitungRisiko` jeda -1 tingkat tinggi. Halte tidak dikenal menghasilkan `GalatApi` kode 404 dengan pesan dari server, dan mitra tanpa base URL gagal dengan pesan yang jelas, bukan crash.

Belum diuji: tampilan di perangkat atau emulator sungguhan, alur login lewat antarmuka, dan build APK release.

## Pekerjaan berikutnya

1. Jalankan di emulator/perangkat dan rapikan tampilan.
2. Isi base URL dua kelompok mitra setelah tersedia di API Registry, lalu tambahkan layar yang memakainya.
3. Branding: ikon, splash, nama aplikasi.
4. Build APK release dan siapkan video demo.

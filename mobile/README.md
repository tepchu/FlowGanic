# FlowGanic Mobile

Aplikasi React Native (Expo) untuk II3140 PWAM. Mengonsumsi microservice FlowGanic, platform koordinasi distribusi sampah Kota Bandung, yang berjalan di STB dan dapat diakses publik di `https://kononkatanya.stei.fun/api`.

**Dokumentasi lengkapnya ada pada bagian PWAM di [`../README.md`](../README.md)** — kerangka aplikasi, diagram navigasi, daftar layar beserta endpoint yang dipanggilnya, aturan validasi login, fungsi `ApiService`, pendekatan mobile first, dan delapan tangkapan layar. Dokumen itu digabung menjadi satu berkas karena pengumpulan hanya meminta satu PDF.

## Menjalankan cepat

Syarat: Node.js 22 dan npm.

```sh
cd mobile
npm install
cp .env.example .env     # isi EXPO_PUBLIC_API_KEY dengan kunci dari kelompok
npx expo start
```

Tekan `w` untuk peramban, `a` untuk emulator Android, atau pindai kode QR dengan Expo Go pada perangkat sungguhan.

Akun demo: `demo@flowganic.id` / `flowganic24`.

## Struktur

| Path | Peran |
| --- | --- |
| `App.js` | Navigasi: stack untuk Masuk dan DetailPermintaan, tab untuk empat layar utama |
| `src/api/ApiService.js` | Satu-satunya tempat pemanggilan HTTP keluar |
| `src/api/konfigurasi.js` | Base URL, API key, akun demo, kode penghasil |
| `src/konteks/SesiContext.js` | Status login dan penyimpanan sesi |
| `src/layar/` | Masuk, Ajukan, Pengolah, Rekap, Profil, DetailPermintaan |
| `src/ui/` | Komponen pakai-ulang, titik ubah responsif, tema |
| `docs/` | Tangkapan layar yang dipakai pada dokumentasi utama |

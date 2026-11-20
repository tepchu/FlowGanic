# FlowGanic Mobile

Aplikasi React Native (Expo) untuk II3140 PWAM. Mengonsumsi microservice FlowGanic yang berjalan di STB dan dapat diakses publik di `https://kononkatanya.stei.fun/api`.

| | |
| --- | --- |
| Kerangka | Expo SDK 58, React Native 0.88, React 19 |
| Navigasi | React Navigation: native stack + bottom tabs |
| Bahasa | JavaScript, tanpa TypeScript |
| Penyimpanan sesi | AsyncStorage |
| Akun demo | `demo@flowganic.id` / `flowganic24` |

## Kerangka aplikasi

Struktur dipisah menurut peran agar tiap bagian dapat diuji dan diganti sendiri-sendiri.

| Path | Peran |
| --- | --- |
| `App.js` | Menyusun navigasi dan membungkus aplikasi dengan penyedia sesi |
| `src/api/ApiService.js` | Satu-satunya tempat pemanggilan HTTP keluar |
| `src/api/konfigurasi.js` | Base URL, API key, akun demo; dibaca dari variabel lingkungan |
| `src/konteks/SesiContext.js` | Status login, simpan dan hapus sesi |
| `src/layar/` | Enam layar aplikasi |
| `src/ui/komponen.js` | Komponen pakai-ulang: Wadah, Kartu, Kolom, Tombol, Pesan, Lencana |
| `src/ui/responsif.js` | Titik ubah mobile first |
| `src/ui/tema.js` | Warna dan jarak |

Aturan yang dipegang: layar tidak pernah memanggil `fetch` sendiri, selalu lewat `ApiService`. Tidak ada URL atau kunci yang ditulis di dalam kode; semuanya dari `.env`.

## Navigasi

Dua lapis. Stack terluar menentukan pengguna sudah masuk atau belum; tab hanya hidup setelah login.

```
Stack (navigator terluar)
│
├── Masuk                 ← tampil bila belum ada sesi
│
└── Utama                 ← tampil bila sesi ada
    │
    ├── Tab
    │   ├── Halte         daftar halte
    │   ├── Rute          cari rute antarmoda
    │   ├── Risiko        hitung risiko transfer
    │   └── Profil        status layanan dan keluar
    │
    └── DetailHalte       ← didorong dari tab Halte
```

Peralihan masuk dan keluar tidak memakai perintah navigasi. `SesiContext` mengubah status, lalu stack merender cabang yang sesuai. Akibatnya layar bertab tidak mungkin terbuka tanpa sesi, dan tombol kembali tidak dapat mengembalikan pengguna ke halaman dalam setelah keluar.

## Layar

| Layar | Letak | Isi | Endpoint |
| --- | --- | --- | --- |
| Masuk | Stack | Form surel dan kata sandi, validasi, pesan galat | — |
| Halte | Tab | Daftar halte, satu kolom di ponsel, dua kolom di layar lebar | `GET /halte` |
| DetailHalte | Stack | Waktu tunggu tiap moda beserta label sumber dan waktu pembaruan | `GET /eta` |
| Rute | Tab | Form asal dan tujuan, hasil berupa langkah perjalanan dan total menit | `GET /rute` |
| Risiko | Tab | Form sisa waktu dan waktu jalan kaki, hasil tingkat risiko | `POST /risiko-transfer` |
| Profil | Tab | Identitas pengguna, base URL, cek status layanan, tombol keluar | `GET /health` |

Tiap layar yang memanggil jaringan memiliki tiga keadaan: sedang memuat dengan indikator, berhasil, dan gagal dengan pesan beserta tombol coba lagi. Layar yang menampilkan data contoh selalu menyertakan label sumbernya, sehingga pengguna tidak menyangka itu informasi operasional.

## Login dan sesi

Validasi dijalankan di perangkat sebelum apa pun dikirim:

| Kolom | Aturan |
| --- | --- |
| Surel | Wajib diisi, harus berpola `nama@domain.tld` |
| Kata sandi | Wajib diisi, minimal 8 karakter |

Pesan galat muncul tepat di bawah kolom yang bersangkutan, dan kolomnya diberi garis tepi berbeda. Bila keduanya lolos, kredensial dicocokkan dengan akun demo; bila cocok, sesi disimpan ke AsyncStorage sehingga pengguna tetap masuk setelah aplikasi ditutup.

Login ini **diverifikasi di perangkat, bukan di server**. Microservice FlowGanic baru menyediakan API key antarlayanan dan belum memiliki endpoint autentikasi pengguna, jadi belum ada token yang diterbitkan server. Batasan ini ditulis terbuka di layar Masuk agar tidak disalahartikan sebagai autentikasi sungguhan. Bila endpoint autentikasi ditambahkan kelak, hanya `SesiContext` dan `ApiService` yang perlu berubah; layar tidak tersentuh.

## Pemanggilan API sendiri

Seluruh lalu lintas keluar melewati satu fungsi di `ApiService.js` yang menangani batas waktu, penyisipan header, penguraian JSON, dan penyeragaman galat.

| Fungsi | Memanggil |
| --- | --- |
| `ApiFlowGanic.cekKesehatan()` | `GET /health`, sengaja tanpa kunci |
| `ApiFlowGanic.ambilHalte()` | `GET /halte` |
| `ApiFlowGanic.cariRute(asal, tujuan)` | `GET /rute?asal=&tujuan=` |
| `ApiFlowGanic.ambilEta(halteId)` | `GET /eta?halte_id=` |
| `ApiFlowGanic.hitungRisiko(sisa, jalan)` | `POST /risiko-transfer` |

Header `X-API-Key` disisipkan otomatis bila `EXPO_PUBLIC_API_KEY` terisi. Permintaan dibatalkan setelah 10 detik agar aplikasi tidak menggantung saat jaringan buruk. Setiap kegagalan dilempar sebagai `GalatApi` dengan pesan berbahasa Indonesia yang layak ditampilkan ke pengguna:

| Keadaan | Pesan |
| --- | --- |
| Kode 401 | API key ditolak layanan |
| Kode 404 | Pesan dari server, misalnya halte tidak ditemukan |
| Kode 429 | Terlalu sering memanggil, coba lagi sebentar lagi |
| Batas waktu | Layanan tidak menjawab tepat waktu |
| Jaringan mati | Tidak dapat menghubungi layanan, periksa koneksi |

Kerangka pemanggilan API kelompok lain sudah disiapkan pada objek `MITRA`, namun base URL-nya sengaja dibiarkan kosong karena integrasi lintas kelompok merupakan lingkup Tugas 3.

## Menjalankan

Syarat: Node.js 22 dan npm.

```sh
cd mobile
npm install
cp .env.example .env
```

Isi `EXPO_PUBLIC_API_KEY` pada `.env` dengan kunci dari kelompok. `EXPO_PUBLIC_API_URL` sudah menunjuk layanan publik, sehingga aplikasi tidak memerlukan backend lokal maupun jaringan yang sama dengan STB.

```sh
npx expo start
```

Tekan `w` untuk peramban, `a` untuk emulator Android, atau pindai kode QR dengan Expo Go pada perangkat sungguhan. Masuk memakai akun demo di tabel paling atas.

| Variabel | Isi |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL microservice, berakhiran `/api` |
| `EXPO_PUBLIC_API_KEY` | API key, dikirim sebagai header `X-API-Key` |
| `EXPO_PUBLIC_MITRA1_*` | Disiapkan untuk Tugas 3, dibiarkan kosong |
| `EXPO_PUBLIC_MITRA2_*` | Disiapkan untuk Tugas 3, dibiarkan kosong |

## Pendekatan mobile first

Gaya dasar ditulis untuk layar ponsel paling sempit tanpa mengasumsikan ruang lebih. Penyesuaian hanya ditambahkan ketika lebar layar mencapai minimum tertentu, sejalan dengan pola `min-width`.

| Titik ubah | Lebar minimum | Penyesuaian |
| --- | --- | --- |
| dasar | 0 | Satu kolom, padding 16, daftar halte satu per baris |
| sedang | 600 | Lebar konten dibatasi 680, padding 24, daftar halte dua kolom, judul membesar |
| lebar | 900 | Lebar konten dibatasi 900 |

React Native tidak mengenal media query CSS, jadi titik ubah dibaca lewat `useWindowDimensions` pada `src/ui/responsif.js`. Pembantu `perLebar({ dasar, sedang, lebar })` mewajibkan nilai `dasar` dan hanya menimpanya bila ambang tercapai, sehingga tata letak ponsel menjadi jalur bawaan, bukan hasil penyusutan dari tata letak lebar.

Target sentuh tombol dan kolom isian dijaga minimal 48 pt. Semua layar memakai `ScrollView` atau `FlatList` agar tetap terpakai pada layar pendek ketika papan ketik terbuka.

## Tangkapan layar

Diambil pada 20 November 2026 dari aplikasi yang berjalan, viewport 420 × 900. Seluruh data pada gambar berasal dari pemanggilan API sungguhan, bukan tiruan.

Pada sesi ini aplikasi diarahkan ke instans microservice lokal yang kodenya identik dengan yang berjalan di STB, sehingga API key produksi tidak ikut terekam dalam gambar. Itu sebabnya layar Profil menampilkan base URL lokal.

### Login dan validasi

| Layar Masuk | Validasi kolom kosong | Kredensial terisi |
| --- | --- | --- |
| ![Layar Masuk](docs/1-masuk.png) | ![Validasi](docs/2-validasi.png) | ![Terisi](docs/3-terisi.png) |

Menekan **Masuk** tanpa mengisi apa pun memunculkan pesan galat di bawah tiap kolom beserta garis tepi merah, dan tidak ada permintaan jaringan yang dikirim.

### Layar utama dan navigasi tab

| Halte | Detail halte | Rute |
| --- | --- | --- |
| ![Halte](docs/4-halte.png) | ![Detail halte](docs/5-detail-halte.png) | ![Rute](docs/6-rute.png) |

Tab Halte memuat tujuh halte dari `GET /halte` dengan label sumber data contoh. Mengetuk sebuah kartu mendorong layar DetailHalte di atas tab melalui stack, menampilkan waktu tunggu dari `GET /eta`. Tab Rute mencari `blok-m` ke `manggarai` lewat `GET /rute` dan mengembalikan 39 menit dalam tiga langkah, lengkap dengan penanda moda.

| Risiko transfer | Profil |
| --- | --- |
| ![Risiko](docs/7-risiko.png) | ![Profil](docs/8-profil.png) |

Risiko transfer mengirim `POST /risiko-transfer` dengan sisa waktu 4 menit dan waktu jalan kaki 5 menit, lalu menampilkan jeda minus satu menit dengan tingkat tinggi. Profil memanggil `GET /health` dan menampilkan `flowganic: ok`, sekaligus menunjukkan status konfigurasi mitra Tugas 3 yang memang belum diisi.

Keempat tab terlihat pada bilah bawah di setiap gambar, dan tab yang sedang aktif ditandai berbeda dari yang lain. Itu bukti navigasi tab bekerja; layar DetailHalte yang tampil dengan tombol kembali dan tanpa bilah tab adalah bukti stack bekerja.

## Status

| Bagian | Keadaan |
| --- | --- |
| Kerangka, navigasi stack dan tab, enam layar | Selesai |
| Login dan form dengan validasi | Selesai, diverifikasi di perangkat |
| Pemanggilan microservice sendiri | Selesai, teruji terhadap layanan yang berjalan |
| Panggilan API kelompok lain | Lingkup Tugas 3, kerangka sudah disiapkan |
| Branding, ikon, splash | Belum dikerjakan |
| Build APK release | Belum dikerjakan |

Pemeriksaan per 20 November 2026: `npx expo export` berhasil untuk target Android maupun web tanpa galat, dan seluruh fungsi `ApiService` diuji langsung terhadap microservice yang berjalan. `cekKesehatan` mengembalikan status aktif, `ambilHalte` mengembalikan tujuh halte, `cariRute` mengembalikan 39 menit dalam tiga langkah, `ambilEta` mengembalikan satu moda, dan `hitungRisiko` mengembalikan jeda minus satu menit dengan tingkat tinggi. Halte yang tidak dikenal menghasilkan galat dengan kode 404 beserta pesan dari server, bukan kegagalan diam.

Belum diuji: tampilan pada perangkat fisik dan alur login melalui antarmuka.

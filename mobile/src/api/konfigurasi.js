// Base URL dan kunci diisi lewat variabel lingkungan Expo (file .env), bukan hardcode.
// Lihat .env.example. Nilai bawaan menunjuk layanan publik.
export const KONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://kononkatanya.stei.fun/api",
  apiKey: process.env.EXPO_PUBLIC_API_KEY ?? "",
  tungguMs: 10000,
};

// Akun demo untuk penilaian. Login masih lokal: microservice FlowGanic belum
// menyediakan endpoint autentikasi pengguna, baru API key antarlayanan.
export const AKUN_DEMO = { surel: "demo@flowganic.id", sandi: "flowganic24" };

// Kode anonim penghasil sampah. Sistem tidak pernah menyimpan nama atau alamat
// warga, sesuai batasan privasi pada Tugas 1.
export const PENGHASIL_REF = "rt03-rumah-12";

export const JENIS_SAMPAH = ["ORGANIK", "ANORGANIK", "RESIDU"];

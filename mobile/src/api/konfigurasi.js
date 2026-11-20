// Base URL dan kunci diisi lewat variabel lingkungan Expo (file .env), bukan hardcode.
// Lihat .env.example. Nilai bawaan menunjuk gateway lokal untuk pengembangan.
export const KONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8080/api",
  apiKey: process.env.EXPO_PUBLIC_API_KEY ?? "",
  tungguMs: 10000,
};

// Akun demo untuk penilaian. Login masih lokal: microservice FlowGanic belum
// menyediakan endpoint autentikasi pengguna, baru API key antarlayanan.
export const AKUN_DEMO = { surel: "demo@flowganic.id", sandi: "flowganic24" };

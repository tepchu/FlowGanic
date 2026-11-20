import { KONFIG } from "./konfigurasi";

export class GalatApi extends Error {
  constructor(pesan, kode) {
    super(pesan);
    this.name = "GalatApi";
    this.kode = kode;
  }
}

function pesanUntuk(kode, badan) {
  if (badan && badan.galat) return badan.galat;
  if (kode === 401) return "API key ditolak layanan.";
  if (kode === 404) return "Data tidak ditemukan.";
  if (kode === 429) return "Terlalu sering memanggil, coba lagi sebentar lagi.";
  return `Layanan membalas kode ${kode}.`;
}

// Satu pintu untuk semua panggilan HTTP: timeout, header kunci, dan galat seragam.
async function minta(url, opsi = {}, kunci = KONFIG.apiKey) {
  const pembatal = new AbortController();
  const waktu = setTimeout(() => pembatal.abort(), KONFIG.tungguMs);
  try {
    const respons = await fetch(url, {
      ...opsi,
      signal: pembatal.signal,
      headers: {
        Accept: "application/json",
        ...(opsi.body ? { "Content-Type": "application/json" } : {}),
        ...(kunci ? { "X-API-Key": kunci } : {}),
        ...opsi.headers,
      },
    });
    const teks = await respons.text();
    let badan = null;
    try {
      badan = teks ? JSON.parse(teks) : null;
    } catch {
      badan = null;
    }
    if (!respons.ok) throw new GalatApi(pesanUntuk(respons.status, badan), respons.status);
    return badan;
  } catch (galat) {
    if (galat instanceof GalatApi) throw galat;
    if (galat.name === "AbortError") throw new GalatApi("Layanan tidak menjawab tepat waktu.", 0);
    throw new GalatApi("Tidak dapat menghubungi layanan. Periksa koneksi.", 0);
  } finally {
    clearTimeout(waktu);
  }
}

function url(jalur, kueri) {
  const dasar = `${KONFIG.baseUrl}${jalur}`;
  if (!kueri) return dasar;
  const bagian = Object.entries(kueri)
    .filter(([, nilai]) => nilai !== undefined && nilai !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return bagian.length ? `${dasar}?${bagian.join("&")}` : dasar;
}

// --- Microservice FlowGanic sendiri -----------------------------------------

export const ApiFlowGanic = {
  cekKesehatan: () => minta(url("/health"), {}, ""),
  ambilHalte: () => minta(url("/halte")),
  cariRute: (asal, tujuan) => minta(url("/rute", { asal, tujuan })),
  ambilEta: (halteId) => minta(url("/eta", { halte_id: halteId })),
  hitungRisiko: (sisaMenit, waktuJalanMenit) =>
    minta(url("/risiko-transfer"), {
      method: "POST",
      body: JSON.stringify({
        sisa_menit: Number(sisaMenit),
        waktu_jalan_menit: Number(waktuJalanMenit),
      }),
    }),
};

// --- API kelompok lain (Tugas 3) --------------------------------------------
// Syarat PWAM: memanggil microservice sendiri + API minimal dua kelompok lain.
// Base URL dan kunci diisi setelah kelompok mitra mengumumkannya di API Registry.
// Jangan menuliskan kunci di sini; pakai variabel EXPO_PUBLIC_* pada .env.

export const MITRA = [
  {
    id: "mitra-satu",
    nama: process.env.EXPO_PUBLIC_MITRA1_NAMA ?? "Kelompok mitra 1",
    baseUrl: process.env.EXPO_PUBLIC_MITRA1_URL ?? "",
    apiKey: process.env.EXPO_PUBLIC_MITRA1_KEY ?? "",
  },
  {
    id: "mitra-dua",
    nama: process.env.EXPO_PUBLIC_MITRA2_NAMA ?? "Kelompok mitra 2",
    baseUrl: process.env.EXPO_PUBLIC_MITRA2_URL ?? "",
    apiKey: process.env.EXPO_PUBLIC_MITRA2_KEY ?? "",
  },
];

export function mitraSiap() {
  return MITRA.filter((m) => m.baseUrl);
}

export function panggilMitra(id, jalur, opsi) {
  const mitra = MITRA.find((m) => m.id === id);
  if (!mitra) throw new GalatApi(`Mitra ${id} tidak dikenal.`, 0);
  if (!mitra.baseUrl) throw new GalatApi(`Base URL ${mitra.nama} belum diisi.`, 0);
  return minta(`${mitra.baseUrl}${jalur}`, opsi, mitra.apiKey);
}

export default ApiFlowGanic;

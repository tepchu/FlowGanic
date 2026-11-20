import { useWindowDimensions } from "react-native";

// Pendekatan mobile first: gaya dasar ditulis untuk layar ponsel paling sempit,
// lalu setiap titik ubah hanya menambah gaya saat lebar layar mencapai minimum.
export const TITIK_UBAH = { sedang: 600, lebar: 900 };

export function useResponsif() {
  const { width } = useWindowDimensions();
  return {
    lebarLayar: width,
    minSedang: width >= TITIK_UBAH.sedang,
    minLebar: width >= TITIK_UBAH.lebar,
  };
}

// Pilih nilai sesuai titik ubah terbesar yang terpenuhi. Nilai `dasar` wajib.
export function perLebar({ dasar, sedang, lebar }, r) {
  if (r.minLebar && lebar !== undefined) return lebar;
  if (r.minSedang && sedang !== undefined) return sedang;
  return dasar;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AKUN_DEMO } from "../api/konfigurasi";

const KUNCI_SIMPAN = "flowganic.sesi";
const SesiContext = createContext(null);

export function PenyediaSesi({ children }) {
  const [pengguna, setPengguna] = useState(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KUNCI_SIMPAN)
      .then((isi) => isi && setPengguna(JSON.parse(isi)))
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  const nilai = useMemo(
    () => ({
      pengguna,
      memuat,
      async masuk(surel, sandi) {
        const cocok =
          surel.trim().toLowerCase() === AKUN_DEMO.surel && sandi === AKUN_DEMO.sandi;
        if (!cocok) throw new Error("Surel atau kata sandi salah.");
        const baru = { surel: AKUN_DEMO.surel, nama: "Pengguna Demo" };
        await AsyncStorage.setItem(KUNCI_SIMPAN, JSON.stringify(baru));
        setPengguna(baru);
      },
      async keluar() {
        await AsyncStorage.removeItem(KUNCI_SIMPAN);
        setPengguna(null);
      },
    }),
    [pengguna, memuat]
  );

  return <SesiContext.Provider value={nilai}>{children}</SesiContext.Provider>;
}

export function useSesi() {
  const nilai = useContext(SesiContext);
  if (!nilai) throw new Error("useSesi harus dipakai di dalam PenyediaSesi.");
  return nilai;
}

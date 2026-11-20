import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Baris, Judul, Kartu, Keterangan, Lencana, Pesan, Pilihan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, JENIS_WARNA, WARNA } from "../ui/tema";
import { JENIS_SAMPAH } from "../api/konfigurasi";
import { ApiFlowGanic } from "../api/ApiService";

export default function LayarPengolah() {
  const [wilayah, setWilayah] = useState([]);
  const [wilayahId, setWilayahId] = useState(null);
  const [jenis, setJenis] = useState(null);
  const [pengolah, setPengolah] = useState([]);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    ApiFlowGanic.ambilWilayah()
      .then((d) => setWilayah(d.wilayah))
      .catch((e) => setGalat(e.message));
  }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const d = await ApiFlowGanic.ambilPengolah(wilayahId, jenis);
      setPengolah(d.pengolah);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, [wilayahId, jenis]);

  useEffect(() => {
    muat();
  }, [muat]);

  const namaWilayah = (id) => wilayah.find((w) => w.id === id)?.nama ?? id;

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Judul>Pengolah</Judul>
        <Keterangan style={styles.jarakBawah}>
          Fasilitas yang menerima sampah dari wilayah layanan, beserta kapasitas hariannya.
        </Keterangan>

        <Kartu>
          <Pilihan
            label="Wilayah"
            nilai={wilayahId}
            opsi={[{ nilai: null, label: "Semua" }, ...wilayah.map((w) => ({ nilai: w.id, label: w.nama }))]}
            onPilih={setWilayahId}
          />
          <Pilihan
            label="Jenis sampah"
            nilai={jenis}
            opsi={[{ nilai: null, label: "Semua" }, ...JENIS_SAMPAH.map((j) => ({ nilai: j, label: j }))]}
            onPilih={setJenis}
          />
        </Kartu>

        <Pesan>{galat}</Pesan>
        {galat ? <Tombol label="Coba lagi" onPress={muat} jenis="garis" /> : null}

        {memuat ? (
          <ActivityIndicator style={styles.pusat} color={WARNA.utama} />
        ) : pengolah.length === 0 ? (
          <Kartu>
            <Keterangan>
              Belum ada pengolah yang melayani kombinasi itu. Coba longgarkan saringannya.
            </Keterangan>
          </Kartu>
        ) : (
          pengolah.map((p) => (
            <Kartu key={p.id}>
              <Text style={styles.nama}>{p.nama}</Text>
              <View style={styles.deret}>
                {p.menerima_jenis.map((j) => (
                  <Lencana key={j} teks={j} warna={JENIS_WARNA[j]} />
                ))}
              </View>
              <Baris kiri="Kapasitas" kanan={`${p.kapasitas_kg_per_hari} kg/hari`} />
              <Baris
                kiri="Melayani"
                kanan={p.melayani_wilayah.map(namaWilayah).join(", ")}
              />
            </Kartu>
          ))
        )}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  pusat: { marginTop: JARAK.lg },
  nama: { fontSize: 16, fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.sm },
  deret: { flexDirection: "row", flexWrap: "wrap", gap: JARAK.xs, marginBottom: JARAK.sm },
  jarakBawah: { marginBottom: JARAK.md },
});

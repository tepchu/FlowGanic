import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Baris, Judul, Kartu, Keterangan, Lencana, Pesan, Pilihan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, JENIS_WARNA, WARNA } from "../ui/tema";
import { JENIS_SAMPAH } from "../api/konfigurasi";
import { ApiFlowGanic } from "../api/ApiService";

export default function LayarRekap({ navigation }) {
  const [wilayah, setWilayah] = useState([]);
  const [wilayahId, setWilayahId] = useState(null);
  const [jenis, setJenis] = useState(null);
  const [rekap, setRekap] = useState(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    ApiFlowGanic.ambilWilayah()
      .then((d) => setWilayah(d.wilayah))
      .catch(() => {});
  }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      setRekap(await ApiFlowGanic.ambilRekap({ wilayahId, jenis }));
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, [wilayahId, jenis]);

  useEffect(() => {
    muat();
  }, [muat]);

  useEffect(() => navigation.addListener("focus", muat), [navigation, muat]);

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Judul>Rekap sampah terkelola</Judul>
        <Keterangan style={styles.jarakBawah}>
          Rekapitulasi agregat untuk koordinator RW dan DLH. Tidak memuat identitas, alamat,
          maupun riwayat permintaan warga mana pun.
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
        ) : rekap ? (
          <>
            <Kartu>
              <Text style={styles.angka}>{rekap.total.terkelola_kg} kg</Text>
              <Keterangan>Sampah terkonfirmasi masuk fasilitas pengolah</Keterangan>
              <Baris kiri="Permintaan masuk" kanan={rekap.total.permintaan} />
              <Baris kiri="Sudah selesai" kanan={rekap.total.selesai} />
              <Baris kiri="Volume diajukan" kanan={`${rekap.total.diajukan_kg} kg`} />
            </Kartu>

            <Kartu>
              <Text style={styles.subjudul}>Per jenis sampah</Text>
              {Object.keys(rekap.per_jenis).length === 0 ? (
                <Keterangan>Belum ada permintaan pada saringan ini.</Keterangan>
              ) : (
                Object.entries(rekap.per_jenis).map(([j, isi]) => (
                  <View key={j} style={styles.blok}>
                    <Lencana teks={j} warna={JENIS_WARNA[j]} />
                    <View style={styles.isiBlok}>
                      <Baris kiri="Permintaan" kanan={isi.permintaan} />
                      <Baris kiri="Selesai" kanan={isi.selesai} />
                      <Baris kiri="Terkelola" kanan={`${isi.terkelola_kg} kg`} />
                    </View>
                  </View>
                ))
              )}
            </Kartu>

            <Keterangan>
              Sumber: {rekap.sumber === "agregat_anonim" ? "agregat anonim" : rekap.sumber}.
              Inilah bentuk data yang dibagikan ke kelompok mitra pada Tugas 3.
            </Keterangan>
          </>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  pusat: { marginTop: JARAK.lg },
  angka: { fontSize: 30, fontWeight: "800", color: WARNA.utama },
  subjudul: { fontWeight: "700", color: WARNA.teks, fontSize: 15, marginBottom: JARAK.sm },
  blok: { marginTop: JARAK.sm },
  isiBlok: { marginTop: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
});

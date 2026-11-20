import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Judul, Kartu, Keterangan, Lencana, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, MODA_WARNA, WARNA } from "../ui/tema";
import { ApiFlowGanic } from "../api/ApiService";

export default function LayarDetailHalte({ route }) {
  const { halte } = route.params;
  const [eta, setEta] = useState(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      setEta(await ApiFlowGanic.ambilEta(halte.id));
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, [halte.id]);

  useEffect(() => {
    ambil();
  }, [ambil]);

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Judul>{halte.nama}</Judul>
        <Keterangan style={styles.jarakBawah}>
          {halte.latitude.toFixed(4)}, {halte.longitude.toFixed(4)}
        </Keterangan>

        <Pesan>{galat}</Pesan>
        {galat ? <Tombol label="Coba lagi" onPress={ambil} jenis="garis" /> : null}

        {memuat ? (
          <ActivityIndicator style={styles.pusat} color={WARNA.utama} />
        ) : eta ? (
          <>
            <Kartu>
              <Text style={styles.subjudul}>Perkiraan waktu tunggu</Text>
              {eta.prediksi.length === 0 ? (
                <Keterangan>Belum ada layanan bermoda dari halte ini pada data contoh.</Keterangan>
              ) : (
                eta.prediksi.map((baris) => (
                  <View key={baris.moda} style={styles.baris}>
                    <Lencana teks={baris.moda} warna={MODA_WARNA[baris.moda]} />
                    <Text style={styles.menit}>{baris.menit_menunggu} menit</Text>
                  </View>
                ))
              )}
            </Kartu>

            <Kartu>
              <Text style={styles.subjudul}>Sumber</Text>
              <Keterangan>
                {eta.sumber === "jadwal_contoh"
                  ? "Dihitung dari interval jadwal contoh, bukan feed GTFS-Realtime dan bukan model AI."
                  : eta.sumber}
              </Keterangan>
              <Keterangan style={styles.jarakAtas}>
                Diperbarui {new Date(eta.diperbarui_pada).toLocaleString("id-ID")}
              </Keterangan>
            </Kartu>
          </>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  pusat: { marginTop: JARAK.lg },
  subjudul: { fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.sm, fontSize: 15 },
  baris: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: JARAK.sm,
    borderTopWidth: 1,
    borderTopColor: WARNA.garis,
  },
  menit: { fontWeight: "700", color: WARNA.teks, fontSize: 16 },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

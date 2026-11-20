import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Judul, Kartu, Keterangan, Lencana, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, WARNA } from "../ui/tema";
import { perLebar, useResponsif } from "../ui/responsif";
import { ApiFlowGanic } from "../api/ApiService";

export default function LayarHalte({ navigation }) {
  const r = useResponsif();
  const [halte, setHalte] = useState([]);
  const [sumber, setSumber] = useState("");
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const data = await ApiFlowGanic.ambilHalte();
      setHalte(data.halte ?? []);
      setSumber(data.sumber ?? "");
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    ambil();
  }, [ambil]);

  // Mobile first: satu kolom di ponsel, dua kolom baru saat layar cukup lebar.
  const kolom = perLebar({ dasar: 1, sedang: 2 }, r);

  if (memuat) {
    return (
      <Wadah>
        <ActivityIndicator style={styles.pusat} color={WARNA.utama} size="large" />
      </Wadah>
    );
  }

  return (
    <Wadah>
      <Judul>Halte</Judul>
      <Keterangan style={styles.jarakBawah}>
        {sumber === "data_contoh"
          ? "Data contoh, bukan informasi operasional aktual."
          : "Daftar titik perpindahan moda."}
      </Keterangan>

      <Pesan>{galat}</Pesan>
      {galat ? <Tombol label="Coba lagi" onPress={ambil} jenis="garis" /> : null}

      <FlatList
        key={`kolom-${kolom}`}
        data={halte}
        keyExtractor={(item) => item.id}
        numColumns={kolom}
        columnWrapperStyle={kolom > 1 ? styles.baris : undefined}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={kolom > 1 ? styles.sel : null}
            onPress={() => navigation.navigate("DetailHalte", { halte: item })}
            accessibilityRole="button"
            accessibilityLabel={`Lihat ETA ${item.nama}`}
          >
            <Kartu>
              <Text style={styles.nama}>{item.nama}</Text>
              <Keterangan>
                {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
              </Keterangan>
              <View style={styles.jarakAtas}>
                <Lencana teks={item.id} />
              </View>
            </Kartu>
          </Pressable>
        )}
      />
    </Wadah>
  );
}

const styles = StyleSheet.create({
  pusat: { marginTop: JARAK.xl },
  nama: { fontSize: 17, fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.xs },
  baris: { gap: JARAK.md },
  sel: { flex: 1 },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

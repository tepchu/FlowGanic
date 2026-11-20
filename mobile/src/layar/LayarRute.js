import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Judul, Kartu, Keterangan, Kolom, Lencana, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, MODA_WARNA, WARNA } from "../ui/tema";
import { ApiFlowGanic } from "../api/ApiService";

function periksa(asal, tujuan) {
  const galat = {};
  const bersih = (n) => n.trim().toLowerCase();
  if (!asal.trim()) galat.asal = "ID halte asal wajib diisi.";
  if (!tujuan.trim()) galat.tujuan = "ID halte tujuan wajib diisi.";
  if (asal.trim() && tujuan.trim() && bersih(asal) === bersih(tujuan))
    galat.tujuan = "Tujuan harus berbeda dari asal.";
  return galat;
}

export default function LayarRute() {
  const [asal, setAsal] = useState("blok-m");
  const [tujuan, setTujuan] = useState("manggarai");
  const [galat, setGalat] = useState({});
  const [pesan, setPesan] = useState("");
  const [rute, setRute] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  async function cari() {
    const hasil = periksa(asal, tujuan);
    setGalat(hasil);
    setPesan("");
    if (Object.keys(hasil).length) return;
    setSibuk(true);
    setRute(null);
    try {
      setRute(await ApiFlowGanic.cariRute(asal.trim().toLowerCase(), tujuan.trim().toLowerCase()));
    } catch (e) {
      setPesan(e.message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Judul>Cari rute</Judul>
        <Keterangan style={styles.jarakBawah}>
          Masukkan ID halte, misalnya blok-m atau manggarai. Daftar ID ada di tab Halte.
        </Keterangan>

        <Kartu>
          <Kolom
            label="Asal"
            value={asal}
            onChangeText={setAsal}
            galat={galat.asal}
            placeholder="blok-m"
            autoCapitalize="none"
          />
          <Kolom
            label="Tujuan"
            value={tujuan}
            onChangeText={setTujuan}
            galat={galat.tujuan}
            placeholder="manggarai"
            autoCapitalize="none"
          />
          <Tombol label="Cari rute" onPress={cari} sibuk={sibuk} />
        </Kartu>

        <Pesan>{pesan}</Pesan>

        {rute ? (
          <Kartu>
            <View style={styles.kepala}>
              <Text style={styles.total}>{rute.total_menit} menit</Text>
              <Lencana teks={`${rute.langkah.length} langkah`} />
            </View>
            {rute.langkah.map((langkah, i) => (
              <View key={`${langkah.asal}-${langkah.tujuan}-${i}`} style={styles.langkah}>
                <Lencana teks={langkah.moda} warna={MODA_WARNA[langkah.moda]} />
                <Text style={styles.jalur}>
                  {langkah.asal} → {langkah.tujuan}
                </Text>
                <Keterangan>
                  Perjalanan {langkah.perjalanan_menit} menit
                  {langkah.menunggu_menit > 0 ? ` · tunggu ${langkah.menunggu_menit} menit` : ""}
                </Keterangan>
              </View>
            ))}
            <Keterangan style={styles.jarakAtas}>
              Sumber: {rute.sumber === "jaringan_contoh" ? "jaringan contoh" : rute.sumber}.
              Bukan informasi operasional aktual.
            </Keterangan>
          </Kartu>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  kepala: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: JARAK.md,
  },
  total: { fontSize: 24, fontWeight: "800", color: WARNA.utama },
  langkah: { paddingVertical: JARAK.sm, borderTopWidth: 1, borderTopColor: WARNA.garis },
  jalur: { fontWeight: "600", color: WARNA.teks, marginTop: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Judul, Kartu, Keterangan, Kolom, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, TINGKAT_WARNA, WARNA } from "../ui/tema";
import { ApiFlowGanic } from "../api/ApiService";

function angkaValid(teks) {
  return /^\d+$/.test(teks.trim());
}

function periksa(sisa, jalan) {
  const galat = {};
  if (!sisa.trim()) galat.sisa = "Sisa waktu wajib diisi.";
  else if (!angkaValid(sisa)) galat.sisa = "Isi bilangan bulat nonnegatif.";
  if (!jalan.trim()) galat.jalan = "Waktu jalan kaki wajib diisi.";
  else if (!angkaValid(jalan)) galat.jalan = "Isi bilangan bulat nonnegatif.";
  return galat;
}

const PENJELASAN = {
  tinggi: "Jeda terlalu tipis. Pertimbangkan keberangkatan berikutnya.",
  sedang: "Masih terkejar, tetapi tanpa banyak ruang untuk hambatan.",
  rendah: "Jeda aman untuk berpindah moda.",
};

export default function LayarRisiko() {
  const [sisa, setSisa] = useState("4");
  const [jalan, setJalan] = useState("5");
  const [galat, setGalat] = useState({});
  const [pesan, setPesan] = useState("");
  const [hasil, setHasil] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  async function hitung() {
    const periksaan = periksa(sisa, jalan);
    setGalat(periksaan);
    setPesan("");
    if (Object.keys(periksaan).length) return;
    setSibuk(true);
    setHasil(null);
    try {
      setHasil(await ApiFlowGanic.hitungRisiko(sisa.trim(), jalan.trim()));
    } catch (e) {
      setPesan(e.message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Judul>Risiko transfer</Judul>
        <Keterangan style={styles.jarakBawah}>
          Bandingkan sisa waktu sebelum keberangkatan dengan lama berjalan kaki ke peron
          atau halte berikutnya.
        </Keterangan>

        <Kartu>
          <Kolom
            label="Sisa waktu (menit)"
            value={sisa}
            onChangeText={setSisa}
            galat={galat.sisa}
            keyboardType="number-pad"
            placeholder="4"
          />
          <Kolom
            label="Waktu jalan kaki (menit)"
            value={jalan}
            onChangeText={setJalan}
            galat={galat.jalan}
            keyboardType="number-pad"
            placeholder="5"
          />
          <Tombol label="Hitung risiko" onPress={hitung} sibuk={sibuk} />
        </Kartu>

        <Pesan>{pesan}</Pesan>

        {hasil ? (
          <Kartu>
            <Text style={[styles.tingkat, { color: TINGKAT_WARNA[hasil.tingkat] }]}>
              Risiko {hasil.tingkat}
            </Text>
            <Text style={styles.jeda}>
              Jeda {hasil.jeda_menit} menit
            </Text>
            <Keterangan style={styles.jarakAtas}>{PENJELASAN[hasil.tingkat]}</Keterangan>
            <Keterangan style={styles.jarakAtas}>
              Metode: {hasil.metode === "aturan_jeda" ? "aturan selisih waktu" : hasil.metode}.
              Belum memakai model prediksi.
            </Keterangan>
          </Kartu>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  tingkat: { fontSize: 24, fontWeight: "800", textTransform: "capitalize" },
  jeda: { fontSize: 16, fontWeight: "600", color: WARNA.teks, marginTop: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

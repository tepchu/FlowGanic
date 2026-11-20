import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Judul, Kartu, Keterangan, Kolom, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, WARNA } from "../ui/tema";
import { AKUN_DEMO } from "../api/konfigurasi";
import { useSesi } from "../konteks/SesiContext";

function periksa(surel, sandi) {
  const galat = {};
  if (!surel.trim()) galat.surel = "Surel wajib diisi.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(surel.trim())) galat.surel = "Format surel tidak valid.";
  if (!sandi) galat.sandi = "Kata sandi wajib diisi.";
  else if (sandi.length < 8) galat.sandi = "Kata sandi minimal 8 karakter.";
  return galat;
}

export default function LayarMasuk() {
  const { masuk } = useSesi();
  const [surel, setSurel] = useState("");
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState({});
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim() {
    const hasil = periksa(surel, sandi);
    setGalat(hasil);
    setPesan("");
    if (Object.keys(hasil).length) return;
    setSibuk(true);
    try {
      await masuk(surel, sandi);
    } catch (e) {
      setPesan(e.message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.isi}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Wadah>
        <ScrollView contentContainerStyle={styles.gulir} keyboardShouldPersistTaps="handled">
          <View style={styles.kepala}>
            <Text style={styles.merek}>FlowGanic</Text>
            <Keterangan>Perjalanan multimoda Jakarta dalam satu layar.</Keterangan>
          </View>

          <Kartu>
            <Judul>Masuk</Judul>
            <Keterangan style={styles.jarakBawah}>
              Gunakan akun demo di bawah untuk penilaian.
            </Keterangan>

            <Pesan>{pesan}</Pesan>

            <Kolom
              label="Surel"
              value={surel}
              onChangeText={setSurel}
              galat={galat.surel}
              placeholder="nama@contoh.id"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Kolom
              label="Kata sandi"
              value={sandi}
              onChangeText={setSandi}
              galat={galat.sandi}
              placeholder="Minimal 8 karakter"
              secureTextEntry
            />
            <Tombol label="Masuk" onPress={kirim} sibuk={sibuk} />
          </Kartu>

          <Kartu>
            <Text style={styles.labelDemo}>Akun demo</Text>
            <Keterangan>
              {AKUN_DEMO.surel} · {AKUN_DEMO.sandi}
            </Keterangan>
            <Keterangan style={styles.jarakAtas}>
              Login masih diverifikasi di perangkat. Microservice FlowGanic baru menyediakan
              API key antarlayanan, belum endpoint autentikasi pengguna.
            </Keterangan>
          </Kartu>
        </ScrollView>
      </Wadah>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  isi: { flex: 1, backgroundColor: WARNA.latar },
  gulir: { paddingVertical: JARAK.lg, justifyContent: "center", flexGrow: 1 },
  kepala: { marginBottom: JARAK.lg },
  merek: { fontSize: 32, fontWeight: "800", color: WARNA.utama },
  labelDemo: { fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

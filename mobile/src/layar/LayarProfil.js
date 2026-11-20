import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Judul, Kartu, Keterangan, Lencana, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, WARNA } from "../ui/tema";
import { KONFIG } from "../api/konfigurasi";
import { ApiFlowGanic, MITRA, mitraSiap } from "../api/ApiService";
import { useSesi } from "../konteks/SesiContext";

export default function LayarProfil() {
  const { pengguna, keluar } = useSesi();
  const [status, setStatus] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function cek() {
    setSibuk(true);
    setGalat("");
    setStatus("");
    try {
      const hasil = await ApiFlowGanic.cekKesehatan();
      setStatus(`${hasil.layanan}: ${hasil.status}`);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  }

  const siap = mitraSiap().length;

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Judul>Profil</Judul>

        <Kartu>
          <Text style={styles.nama}>{pengguna?.nama}</Text>
          <Keterangan>{pengguna?.surel}</Keterangan>
        </Kartu>

        <Kartu>
          <Text style={styles.subjudul}>Microservice FlowGanic</Text>
          <Keterangan>{KONFIG.baseUrl}</Keterangan>
          <View style={styles.jarakAtas}>
            <Lencana teks={KONFIG.apiKey ? "API key terpasang" : "tanpa API key"} />
          </View>
          <View style={styles.jarakAtas}>
            <Tombol label="Cek status layanan" onPress={cek} sibuk={sibuk} jenis="garis" />
          </View>
          {status ? <Keterangan style={styles.jarakAtas}>{status}</Keterangan> : null}
          <Pesan>{galat}</Pesan>
        </Kartu>

        <Kartu>
          <Text style={styles.subjudul}>API kelompok lain</Text>
          <Keterangan style={styles.jarakBawah}>
            Mitra yang direncanakan pada Tugas 1 adalah kelompok bertema Pendidikan, yang
            memakai rekap agregat FlowGanic sebagai bahan edukasi pemilahan sampah. Base URL
            diisi lewat .env setelah mitra mengumumkannya di API Registry.
          </Keterangan>
          {MITRA.map((m) => (
            <View key={m.id} style={styles.barisMitra}>
              <Text style={styles.namaMitra}>{m.nama}</Text>
              <Lencana teks={m.baseUrl ? "siap" : "belum diisi"} />
            </View>
          ))}
          <Keterangan style={styles.jarakAtas}>
            {siap} dari {MITRA.length} mitra sudah dikonfigurasi.
          </Keterangan>
        </Kartu>

        <Tombol label="Keluar" onPress={keluar} jenis="garis" />
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  nama: { fontSize: 18, fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.xs },
  subjudul: { fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.sm, fontSize: 15 },
  barisMitra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: JARAK.sm,
    borderTopWidth: 1,
    borderTopColor: WARNA.garis,
  },
  namaMitra: { color: WARNA.teks, fontWeight: "600" },
  jarakAtas: { marginTop: JARAK.sm },
  jarakBawah: { marginBottom: JARAK.sm },
});

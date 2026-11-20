import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Judul, Kartu, Keterangan, Kolom, Lencana, Pesan, Pilihan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, JENIS_WARNA, STATUS_LABEL, STATUS_WARNA, WARNA } from "../ui/tema";
import { JENIS_SAMPAH, PENGHASIL_REF } from "../api/konfigurasi";
import { ApiFlowGanic } from "../api/ApiService";

const KUNCI_RIWAYAT = "flowganic.permintaan";

function tanggalBawaan(tambahHari = 3) {
  const t = new Date();
  t.setDate(t.getDate() + tambahHari);
  return t.toISOString().slice(0, 10);
}

function periksa(wilayahId, jenis, kg, jadwal) {
  const galat = {};
  if (!wilayahId) galat.wilayah = "Pilih wilayah penjemputan.";
  if (!jenis) galat.jenis = "Pilih jenis sampah.";
  if (!String(kg).trim()) galat.kg = "Perkiraan berat wajib diisi.";
  else if (!/^\d+$/.test(String(kg).trim())) galat.kg = "Isi bilangan bulat, dalam kilogram.";
  else if (Number(kg) < 1 || Number(kg) > 1000) galat.kg = "Berat harus antara 1 dan 1000 kg.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jadwal)) galat.jadwal = "Gunakan format YYYY-MM-DD.";
  else if (jadwal < new Date().toISOString().slice(0, 10))
    galat.jadwal = "Jadwal tidak boleh tanggal yang sudah lewat.";
  return galat;
}

export default function LayarAjukan({ navigation }) {
  const [wilayah, setWilayah] = useState([]);
  const [wilayahId, setWilayahId] = useState(null);
  const [jenis, setJenis] = useState("ORGANIK");
  const [kg, setKg] = useState("20");
  const [jadwal, setJadwal] = useState(tanggalBawaan());
  const [galat, setGalat] = useState({});
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [riwayat, setRiwayat] = useState([]);

  const muatRiwayat = useCallback(async () => {
    const tersimpan = JSON.parse((await AsyncStorage.getItem(KUNCI_RIWAYAT)) ?? "[]");
    const segar = [];
    for (const id of tersimpan.slice(0, 5)) {
      try {
        segar.push(await ApiFlowGanic.lacakPermintaan(id));
      } catch {
        // Permintaan yang hilang dari server cukup dilewati.
      }
    }
    setRiwayat(segar);
  }, []);

  useEffect(() => {
    ApiFlowGanic.ambilWilayah()
      .then((d) => {
        setWilayah(d.wilayah);
        const pilot = d.wilayah.find((w) => w.pilot) ?? d.wilayah[0];
        setWilayahId(pilot?.id ?? null);
      })
      .catch((e) => setPesan(e.message));
    muatRiwayat();
  }, [muatRiwayat]);

  useEffect(() => navigation.addListener("focus", muatRiwayat), [navigation, muatRiwayat]);

  async function kirim() {
    const hasil = periksa(wilayahId, jenis, kg, jadwal);
    setGalat(hasil);
    setPesan("");
    if (Object.keys(hasil).length) return;
    setSibuk(true);
    try {
      const permintaan = await ApiFlowGanic.ajukanPermintaan({
        penghasilRef: PENGHASIL_REF,
        wilayahId,
        jenis,
        perkiraanKg: kg.trim(),
        jadwal,
      });
      const tersimpan = JSON.parse((await AsyncStorage.getItem(KUNCI_RIWAYAT)) ?? "[]");
      if (!tersimpan.includes(permintaan.id)) {
        await AsyncStorage.setItem(KUNCI_RIWAYAT, JSON.stringify([permintaan.id, ...tersimpan]));
      }
      setPesan(
        permintaan.duplikat
          ? "Permintaan serupa sudah ada untuk tanggal itu, jadi tidak digandakan."
          : ""
      );
      await muatRiwayat();
      navigation.navigate("DetailPermintaan", { id: permintaan.id });
    } catch (e) {
      setPesan(e.message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Judul>Ajukan penjemputan</Judul>
        <Keterangan style={styles.jarakBawah}>
          Sistem mencocokkan permintaan Anda dengan pengolah yang melayani wilayah dan jenis
          sampah tersebut, dan masih punya sisa kapasitas pada tanggal itu.
        </Keterangan>

        <Pesan nada={pesan.includes("digandakan") ? "info" : "galat"}>{pesan}</Pesan>

        <Kartu>
          <Pilihan
            label="Wilayah"
            nilai={wilayahId}
            galat={galat.wilayah}
            opsi={wilayah.map((w) => ({ nilai: w.id, label: w.nama }))}
            onPilih={setWilayahId}
          />
          <Pilihan
            label="Jenis sampah"
            nilai={jenis}
            galat={galat.jenis}
            opsi={JENIS_SAMPAH.map((j) => ({ nilai: j, label: j }))}
            onPilih={setJenis}
          />
          <Kolom
            label="Perkiraan berat (kg)"
            value={kg}
            onChangeText={setKg}
            galat={galat.kg}
            keyboardType="number-pad"
            placeholder="20"
          />
          <Kolom
            label="Tanggal penjemputan"
            value={jadwal}
            onChangeText={setJadwal}
            galat={galat.jadwal}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Tombol label="Ajukan penjemputan" onPress={kirim} sibuk={sibuk} />
        </Kartu>

        {riwayat.length > 0 ? (
          <>
            <Text style={styles.subjudul}>Permintaan terakhir</Text>
            {riwayat.map((p) => (
              <Kartu key={p.id}>
                <View style={styles.kepala}>
                  <Lencana teks={p.jenis} warna={JENIS_WARNA[p.jenis]} />
                  <Text style={styles.kg}>{p.perkiraan_kg} kg</Text>
                </View>
                <Text style={styles.jadwal}>Dijemput {p.jadwal}</Text>
                <View style={styles.jarakAtas}>
                  <Lencana teks={STATUS_LABEL[p.status]} warna={STATUS_WARNA[p.status]} />
                </View>
                <View style={styles.jarakAtas}>
                  <Tombol
                    label="Lihat detail"
                    jenis="garis"
                    onPress={() => navigation.navigate("DetailPermintaan", { id: p.id })}
                  />
                </View>
              </Kartu>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  subjudul: { fontWeight: "700", color: WARNA.teks, fontSize: 15, marginBottom: JARAK.sm },
  kepala: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kg: { fontSize: 18, fontWeight: "800", color: WARNA.teks },
  jadwal: { color: WARNA.teksRedup, fontSize: 13, marginTop: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

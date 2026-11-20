import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Baris, Judul, Kartu, Keterangan, Kolom, Lencana, Pesan, Tombol, Wadah } from "../ui/komponen";
import { JARAK, JENIS_WARNA, STATUS_LABEL, STATUS_WARNA, WARNA } from "../ui/tema";
import { ApiFlowGanic } from "../api/ApiService";

const PENJELASAN = {
  diajukan: "Belum ada pengolah yang sanggup pada tanggal ini. Sistem akan mencocokkan ulang bila kapasitas terbuka.",
  dijadwalkan: "Sudah dicocokkan ke pengolah. Menunggu penjemputan pada tanggal yang diminta.",
  ditolak: "Tidak ada pengolah yang dapat melayani permintaan ini.",
  selesai: "Sampah sudah diterima dan volumenya dikonfirmasi pengolah.",
};

export default function LayarDetailPermintaan({ route }) {
  const { id } = route.params;
  const [permintaan, setPermintaan] = useState(null);
  const [volume, setVolume] = useState("");
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const p = await ApiFlowGanic.lacakPermintaan(id);
      setPermintaan(p);
      setVolume(String(p.perkiraan_kg));
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function jalankan(aksi) {
    if (aksi === "selesai" && !/^\d+$/.test(volume.trim())) {
      setGalat("Volume terkonfirmasi harus bilangan bulat dalam kilogram.");
      return;
    }
    setSibuk(true);
    setGalat("");
    try {
      setPermintaan(
        await ApiFlowGanic.perbaruiPermintaan(
          id, aksi, aksi === "selesai" ? volume.trim() : undefined)
      );
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  }

  if (memuat) {
    return (
      <Wadah>
        <ActivityIndicator style={styles.pusat} color={WARNA.utama} size="large" />
      </Wadah>
    );
  }

  const terbuka = permintaan && ["diajukan", "dijadwalkan"].includes(permintaan.status);

  return (
    <Wadah>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pesan>{galat}</Pesan>

        {permintaan ? (
          <>
            <Judul>Permintaan {permintaan.id}</Judul>
            <View style={styles.deret}>
              <Lencana teks={permintaan.jenis} warna={JENIS_WARNA[permintaan.jenis]} />
              <Lencana
                teks={STATUS_LABEL[permintaan.status]}
                warna={STATUS_WARNA[permintaan.status]}
              />
            </View>
            <Keterangan style={styles.jarakBawah}>{PENJELASAN[permintaan.status]}</Keterangan>

            <Kartu>
              <Baris kiri="Penghasil" kanan={permintaan.penghasil_ref} />
              <Baris kiri="Wilayah" kanan={permintaan.wilayah_id} />
              <Baris kiri="Perkiraan" kanan={`${permintaan.perkiraan_kg} kg`} />
              <Baris kiri="Jadwal" kanan={permintaan.jadwal} />
              <Baris kiri="Pengolah" kanan={permintaan.pengolah_id ?? "belum ada"} />
              <Baris
                kiri="Volume terkonfirmasi"
                kanan={permintaan.volume_kg ? `${permintaan.volume_kg} kg` : "belum"}
              />
            </Kartu>

            {terbuka ? (
              <Kartu>
                <Text style={styles.subjudul}>Tindakan pengolah</Text>
                <Keterangan style={styles.jarakBawah}>
                  Menolak akan mencari pengolah lain lebih dahulu sebelum permintaan ditutup.
                </Keterangan>
                <Kolom
                  label="Volume sebenarnya (kg)"
                  value={volume}
                  onChangeText={setVolume}
                  keyboardType="number-pad"
                />
                <Tombol label="Konfirmasi selesai" onPress={() => jalankan("selesai")} sibuk={sibuk} />
                <View style={styles.jarakAtas}>
                  <Tombol label="Tolak penugasan" jenis="garis" onPress={() => jalankan("tolak")} />
                </View>
              </Kartu>
            ) : null}

            <Keterangan>
              Dibuat {permintaan.dibuat_pada} · diperbarui {permintaan.diperbarui_pada}
            </Keterangan>
          </>
        ) : null}
      </ScrollView>
    </Wadah>
  );
}

const styles = StyleSheet.create({
  pusat: { marginTop: JARAK.xl },
  deret: { flexDirection: "row", flexWrap: "wrap", gap: JARAK.sm, marginBottom: JARAK.sm },
  subjudul: { fontWeight: "700", color: WARNA.teks, fontSize: 15, marginBottom: JARAK.xs },
  jarakBawah: { marginBottom: JARAK.md },
  jarakAtas: { marginTop: JARAK.sm },
});

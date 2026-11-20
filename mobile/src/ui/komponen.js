import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { JARAK, WARNA } from "./tema";
import { perLebar, useResponsif } from "./responsif";

// Wadah utama: satu kolom penuh di ponsel, lalu dibatasi lebarnya dan
// diberi padding lebih lega begitu layar mencapai titik ubah.
export function Wadah({ children, style }) {
  const r = useResponsif();
  return (
    <View style={styles.wadahLuar}>
      <View
        style={[
          styles.wadah,
          {
            maxWidth: perLebar({ dasar: "100%", sedang: 680, lebar: 900 }, r),
            paddingHorizontal: perLebar({ dasar: JARAK.md, sedang: JARAK.lg }, r),
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function Kartu({ children, style }) {
  return <View style={[styles.kartu, style]}>{children}</View>;
}

export function Judul({ children }) {
  const r = useResponsif();
  return (
    <Text style={[styles.judul, { fontSize: perLebar({ dasar: 22, sedang: 26 }, r) }]}>
      {children}
    </Text>
  );
}

export function Keterangan({ children, style }) {
  return <Text style={[styles.keterangan, style]}>{children}</Text>;
}

export function Kolom({ label, galat, ...sisa }) {
  return (
    <View style={styles.kolom}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.masukan, galat ? styles.masukanGalat : null]}
        placeholderTextColor={WARNA.teksRedup}
        accessibilityLabel={label}
        {...sisa}
      />
      {galat ? <Text style={styles.pesanGalat}>{galat}</Text> : null}
    </View>
  );
}

export function Tombol({ label, onPress, sibuk, jenis = "utama" }) {
  const nonaktif = sibuk === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={nonaktif}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.tombol,
        jenis === "garis" && styles.tombolGaris,
        (pressed || nonaktif) && styles.tombolTekan,
      ]}
    >
      {sibuk ? (
        <ActivityIndicator color={jenis === "garis" ? WARNA.utama : "#fff"} />
      ) : (
        <Text style={[styles.tombolTeks, jenis === "garis" && styles.tombolTeksGaris]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Pesan({ nada = "galat", children }) {
  if (!children) return null;
  return (
    <View style={[styles.pesan, nada === "galat" ? styles.pesanMerah : styles.pesanBiru]}>
      <Text style={styles.pesanTeks}>{children}</Text>
    </View>
  );
}

export function Lencana({ teks, warna }) {
  return (
    <View style={[styles.lencana, { backgroundColor: warna ?? WARNA.utamaRedup }]}>
      <Text style={[styles.lencanaTeks, warna ? { color: "#fff" } : null]}>{teks}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wadahLuar: { flex: 1, alignItems: "center", backgroundColor: WARNA.latar },
  wadah: { flex: 1, width: "100%", paddingVertical: JARAK.md },
  kartu: {
    backgroundColor: WARNA.kartu,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WARNA.garis,
    padding: JARAK.md,
    marginBottom: JARAK.md,
  },
  judul: { fontWeight: "700", color: WARNA.teks, marginBottom: JARAK.xs },
  keterangan: { color: WARNA.teksRedup, fontSize: 13, lineHeight: 18 },
  kolom: { marginBottom: JARAK.md },
  label: { fontWeight: "600", color: WARNA.teks, marginBottom: JARAK.xs, fontSize: 14 },
  masukan: {
    borderWidth: 1,
    borderColor: WARNA.garis,
    borderRadius: 10,
    paddingHorizontal: JARAK.md,
    paddingVertical: 12,
    fontSize: 16,
    color: WARNA.teks,
    backgroundColor: WARNA.kartu,
    minHeight: 48,
  },
  masukanGalat: { borderColor: WARNA.bahaya },
  pesanGalat: { color: WARNA.bahaya, fontSize: 13, marginTop: JARAK.xs },
  tombol: {
    backgroundColor: WARNA.utama,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  tombolGaris: { backgroundColor: "transparent", borderWidth: 1, borderColor: WARNA.utama },
  tombolTekan: { opacity: 0.7 },
  tombolTeks: { color: "#fff", fontWeight: "700", fontSize: 16 },
  tombolTeksGaris: { color: WARNA.utama },
  pesan: { borderRadius: 10, padding: JARAK.md, marginBottom: JARAK.md },
  pesanMerah: { backgroundColor: "#fdecea" },
  pesanBiru: { backgroundColor: WARNA.utamaRedup },
  pesanTeks: { color: WARNA.teks, fontSize: 14 },
  lencana: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lencanaTeks: { fontSize: 12, fontWeight: "700", color: WARNA.utama },
});

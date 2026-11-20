import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PenyediaSesi, useSesi } from "./src/konteks/SesiContext";
import LayarMasuk from "./src/layar/LayarMasuk";
import LayarAjukan from "./src/layar/LayarAjukan";
import LayarPengolah from "./src/layar/LayarPengolah";
import LayarRekap from "./src/layar/LayarRekap";
import LayarDetailPermintaan from "./src/layar/LayarDetailPermintaan";
import LayarProfil from "./src/layar/LayarProfil";
import { WARNA } from "./src/ui/tema";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const IKON = { Ajukan: "✚", Pengolah: "◉", Rekap: "▤", Profil: "☻" };

function ikonTab(nama) {
  return ({ color }) => <Text style={[styles.ikon, { color }]}>{IKON[nama]}</Text>;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: styles.kepala,
        headerTitleStyle: styles.kepalaJudul,
        tabBarActiveTintColor: WARNA.utama,
        tabBarInactiveTintColor: WARNA.teksRedup,
        tabBarIcon: ikonTab(route.name),
        tabBarLabelStyle: styles.labelTab,
      })}
    >
      <Tab.Screen name="Ajukan" component={LayarAjukan} options={{ title: "Ajukan" }} />
      <Tab.Screen name="Pengolah" component={LayarPengolah} options={{ title: "Pengolah" }} />
      <Tab.Screen name="Rekap" component={LayarRekap} options={{ title: "Rekap" }} />
      <Tab.Screen name="Profil" component={LayarProfil} options={{ title: "Profil" }} />
    </Tab.Navigator>
  );
}

function Navigasi() {
  const { pengguna, memuat } = useSesi();

  if (memuat) {
    return (
      <View style={styles.pemuat}>
        <ActivityIndicator size="large" color={WARNA.utama} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {pengguna ? (
        <>
          <Stack.Screen name="Utama" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="DetailPermintaan"
            component={LayarDetailPermintaan}
            options={{ title: "Detail permintaan" }}
          />
        </>
      ) : (
        <Stack.Screen name="Masuk" component={LayarMasuk} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PenyediaSesi>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Navigasi />
        </NavigationContainer>
      </PenyediaSesi>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  pemuat: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: WARNA.latar },
  ikon: { fontSize: 13, lineHeight: 14 },
  labelTab: { fontSize: 10, lineHeight: 11 },
  kepala: { backgroundColor: WARNA.kartu },
  kepalaJudul: { color: WARNA.teks },
});

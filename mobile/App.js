import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PenyediaSesi, useSesi } from "./src/konteks/SesiContext";
import LayarMasuk from "./src/layar/LayarMasuk";
import LayarHalte from "./src/layar/LayarHalte";
import LayarDetailHalte from "./src/layar/LayarDetailHalte";
import LayarRute from "./src/layar/LayarRute";
import LayarRisiko from "./src/layar/LayarRisiko";
import LayarProfil from "./src/layar/LayarProfil";
import { WARNA } from "./src/ui/tema";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const IKON = { Halte: "◉", Rute: "⇄", Risiko: "⌁", Profil: "☻" };

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
      <Tab.Screen name="Halte" component={LayarHalte} options={{ title: "Halte" }} />
      <Tab.Screen name="Rute" component={LayarRute} options={{ title: "Rute" }} />
      <Tab.Screen name="Risiko" component={LayarRisiko} options={{ title: "Risiko transfer" }} />
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
            name="DetailHalte"
            component={LayarDetailHalte}
            options={({ route }) => ({ title: route.params.halte.nama })}
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
  ikon: { fontSize: 18 },
  labelTab: { fontSize: 11 },
  kepala: { backgroundColor: WARNA.kartu },
  kepalaJudul: { color: WARNA.teks },
});

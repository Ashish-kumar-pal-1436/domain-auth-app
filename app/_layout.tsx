
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";

function AppNavigation() {
  const { user, role, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const currentRoute = segments[0] as string | undefined;

  useEffect(() => {
    if (loading) return;

    const onDashboard = currentRoute === "dashboard";
    const onAdmin = currentRoute === "admin";

    if (!user) {
      if (onDashboard || onAdmin) {
        router.replace("/");
      }
      return;
    }

    if (onAdmin && role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    if (currentRoute === undefined) {
      router.replace("/dashboard");
    }
  }, [user, role, loading, currentRoute, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#ffffff" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
  );
}

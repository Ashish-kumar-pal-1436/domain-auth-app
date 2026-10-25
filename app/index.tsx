import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import { ResponseType } from "expo-auth-session";
import { useAuth } from "../src/auth/AuthProvider";

export default function LoginScreen() {
  const { loginWithGoogleWeb, loginWithGoogleToken, error, clearError } =
    useAuth();

  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    responseType: ResponseType.IdToken,
  });

  useEffect(() => {
    if (Platform.OS === "web" || response?.type !== "success") return;

    const idToken =
      response.params?.id_token || response.authentication?.idToken;

    if (!idToken) {
      Alert.alert(
        "Sign-in failed",
        "Google did not return an ID token. Please try again."
      );
      setBusy(false);
      return;
    }

    loginWithGoogleToken(idToken)
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [response, loginWithGoogleToken]);

  const handleGoogleSignIn = async () => {
    clearError();
    setBusy(true);

    if (Platform.OS === "web") {
      try {
        await loginWithGoogleWeb();
      } catch {
        // The authentication provider supplies the error message.
      } finally {
        setBusy(false);
      }

      return;
    }

    if (
      !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID &&
      !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    ) {
      Alert.alert(
        "Setup required",
        "Add the Android or iOS Google OAuth client ID to .env.local before signing in on a mobile device."
      );
      setBusy(false);
      return;
    }

    try {
      await promptAsync();
    } catch {
      Alert.alert("Sign-in failed", "Please try again.");
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <Text style={styles.appName}>HB Plus</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.description}>
            Use your organization Google account to access the workspace.
          </Text>

          <Text style={styles.label}>ALLOWED EMAIL DOMAIN</Text>
          <View style={styles.domainBox}>
            <Text style={styles.domain}>@hbplus.fit</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy || (Platform.OS !== "web" && !request)}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              (busy || (Platform.OS !== "web" && !request)) &&
                styles.buttonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Continue with Google</Text>
            )}
          </Pressable>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Text style={styles.note}>
            Only verified accounts ending in @hbplus.fit are permitted.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f6f8",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 400,
  },
  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#202938",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e1e5eb",
    borderRadius: 10,
    padding: 24,
  },
  heading: {
    color: "#202938",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    color: "#626b79",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  label: {
    color: "#626b79",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  domainBox: {
    backgroundColor: "#f7f8fa",
    borderWidth: 1,
    borderColor: "#e1e5eb",
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
  },
  domain: {
    color: "#202938",
    fontSize: 15,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563eb",
    minHeight: 46,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: "#b42318",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  note: {
    color: "#626b79",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
});
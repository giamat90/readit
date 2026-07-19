import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Headphones } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants";

type Mode = "signIn" | "signUp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading || !email.trim() || !password) return;
    setLoading(true);
    setErrorKey(null);
    try {
      const credentials = { email: email.trim(), password };
      const { error } =
        mode === "signIn"
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials);
      if (error) {
        setErrorKey(
          error.message.toLowerCase().includes("invalid login credentials")
            ? "auth.errorInvalidCredentials"
            : "auth.errorGeneric"
        );
      }
      // On success the onAuthStateChange listener in app/_layout.tsx
      // stores the session and the routing guard redirects to (tabs).
    } catch {
      setErrorKey("auth.errorGeneric");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="flex-1 justify-center px-8">
        <View className="items-center pb-8">
          <Headphones color={COLORS.primary} size={48} />
          <Text className="mt-3 text-3xl font-bold text-ink dark:text-paper">ReadIt</Text>
          <Text className="mt-1 text-base text-muted">
            {t(mode === "signIn" ? "auth.signIn" : "auth.signUp")}
          </Text>
        </View>

        {errorKey && (
          <View className="mb-4 rounded-lg bg-danger/10 px-4 py-3">
            <Text className="text-sm text-danger">{t(errorKey)}</Text>
          </View>
        )}

        <TextInput
          className="mb-3 rounded-lg border border-muted/30 bg-white px-4 py-3 text-base text-ink dark:bg-ink dark:text-paper"
          placeholder={t("auth.email")}
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          className="mb-6 rounded-lg border border-muted/30 bg-white px-4 py-3 text-base text-ink dark:bg-ink dark:text-paper"
          placeholder={t("auth.password")}
          placeholderTextColor={COLORS.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          editable={!loading}
        />

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          disabled={loading || !email.trim() || !password}
          className={`items-center rounded-lg bg-primary py-3.5 ${
            loading || !email.trim() || !password ? "opacity-40" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {t(mode === "signIn" ? "auth.submitSignIn" : "auth.submitSignUp")}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setErrorKey(null);
          }}
          disabled={loading}
          className="mt-6 items-center"
        >
          <Text className="text-sm text-secondary">
            {t(mode === "signIn" ? "auth.toggleToSignUp" : "auth.toggleToSignIn")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

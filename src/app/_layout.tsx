import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerTintColor: "#20223d" }}>
        <Stack.Screen name="index" options={{ title: "My tasks" }} />
        <Stack.Screen
          name="tasks/[taskId]/index"
          options={{ title: "Task details" }}
        />
        <Stack.Screen
          name="tasks/[taskId]/capture"
          options={{ title: "Complete task" }}
        />
      </Stack>
    </ThemeProvider>
  );
}

import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { findDemoTask } from "@/features/worker/demo-worker-task";

export default function TaskDetailsScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const task = findDemoTask(taskId);

  if (!task) {
    return <Text style={styles.missing}>Task not found.</Text>;
  }

  const details = [
    ["Warehouse / location", `${task.warehouse} · ${task.location}`],
    ["Due", task.dueLabel],
    ["Template", `${task.form.details.name} · v${task.form.version}`],
    ["Supervisor", task.supervisorName],
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.badge}>{task.status}</Text>

      <View style={styles.card}>
        {details.map(([label, value]) => (
          <View key={label} style={{ gap: 4 }}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.muted}>{task.instructions}</Text>

      <Link
        href={{
          pathname: "/tasks/[taskId]/capture",
          params: { taskId: task.id },
        }}
        asChild
      >
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Start capture</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  missing: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#20223d" },
  badge: {
    alignSelf: "flex-start",
    color: "#4f46e5",
    backgroundColor: "#ecebff",
    fontWeight: "700",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e1e5ef",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 18,
  },
  muted: { color: "#59617d", lineHeight: 20 },
  value: { color: "#20223d", fontSize: 16, fontWeight: "600" },
  button: {
    minHeight: 48,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});

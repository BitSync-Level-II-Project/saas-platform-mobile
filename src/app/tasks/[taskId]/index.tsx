import { Link, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { findDemoTask } from "@/features/worker/demo-worker-task";
import { localRecordLabel, workerIdentity, workerSlotKey } from "@/features/worker/worker-offline-model";
import { useWorkerRecords } from "@/features/worker/use-worker-records";

export default function TaskDetailsScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const task = findDemoTask(taskId);
  const tasks = useMemo(() => task ? [task] : [], [task]);
  const { records, retryLoad } = useWorkerRecords(tasks);

  if (!task) {
    return <Text style={styles.missing}>Task not found.</Text>;
  }

  const read = records[workerSlotKey(workerIdentity(task))];
  const phase = read?.kind === "found" ? read.slot.phase : null;
  const actionLabel = phase === "draft" ? "Resume draft" : phase === "pending-demo" ? "Retry demo"
    : phase === "confirmed-demo" ? "View demo receipt" : "Start capture";

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
      <Text style={styles.muted}>Demo workspace · {localRecordLabel(read) ?? "No saved record"}</Text>
      {(read?.kind === "invalid" || read?.kind === "unavailable") && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={styles.muted}>{read.message}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad} style={styles.button}><Text style={styles.buttonText}>Retry load</Text></Pressable>
        </View>
      )}

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
          <Text style={styles.buttonText}>{!read ? "Loading saved record…" : read.kind === "invalid" || read.kind === "unavailable" ? "View saved record issue" : actionLabel}</Text>
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

import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { demoWorkerTasks } from "@/features/worker/demo-worker-task";

export default function MyTasksScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Text style={{ color: "#20223d", fontSize: 24, fontWeight: "700" }}>
        Good morning, Kavindu
      </Text>
      <Text style={{ color: "#59617d" }}>Colombo warehouse · Demo</Text>
      <Text style={{ color: "#20223d", fontSize: 17, fontWeight: "700" }}>
        Assigned tasks
      </Text>

      {demoWorkerTasks.map((task) => (
        <Link
          key={task.id}
          href={{ pathname: "/tasks/[taskId]", params: { taskId: task.id } }}
          asChild
        >
          <Pressable
            style={{
              gap: 10,
              padding: 16,
              borderRadius: 14,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e1e5ef",
            }}
          >
            <Text style={{ color: "#20223d", fontSize: 17, fontWeight: "700" }}>
              {task.title}
            </Text>
            <Text style={{ color: "#59617d" }}>
              {task.location} · {task.code}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#ecebff",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: "#4f46e5", fontWeight: "700" }}>
                {task.status}
              </Text>
            </View>
            <Text style={{ color: "#59617d" }}>{task.dueLabel}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import WorkerFormScreen from "@/features/worker/WorkerFormScreen";
import { findDemoTask } from "@/features/worker/demo-worker-task";

export default function TaskCaptureRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const task = findDemoTask(taskId);

  if (!task || task.form.versionId !== task.templateVersionId) {
    return <Text style={{ padding: 20 }}>The task form is unavailable.</Text>;
  }

  return <WorkerFormScreen key={JSON.stringify([task.id, task.templateVersionId])} task={task} />;
}

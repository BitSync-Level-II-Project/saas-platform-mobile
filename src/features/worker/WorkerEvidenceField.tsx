import { Text, View } from "react-native";
import { WorkerEvidencePreview } from "./WorkerEvidencePreview";
import type { WorkerEvidenceProps } from "./worker-camera-props";

export function WorkerEvidenceField({ uri, hasEvidence, required }: WorkerEvidenceProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: "#20223d", fontWeight: "600" }}>Photo evidence{required ? " *" : " (optional)"}</Text>
      <WorkerEvidencePreview uri={uri} hasEvidence={hasEvidence} />
      <Text style={{ color: "#59617d", lineHeight: 21 }}>
        {required ? "This task requires a photo. Use a phone to review and complete it." : "Use a phone for photo capture. You can continue without a photo for this task."}
      </Text>
    </View>
  );
}

import { useState } from "react";
import { Image, Text, View } from "react-native";

export function WorkerEvidencePreview({ uri, hasEvidence }: { uri: string | null; hasEvidence: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      {uri && uri !== failedUri ? (
        <Image accessibilityLabel="Photo evidence preview" source={{ uri }} resizeMode="contain"
          style={{ width: "100%", height: 220, borderRadius: 10, backgroundColor: "#eef0f6" }}
          onError={() => setFailedUri(uri)} />
      ) : (
        <Text style={{ color: hasEvidence ? "#b42318" : "#59617d" }}>
          {hasEvidence ? "Saved photo is missing or unreadable." : "No photo attached."}
        </Text>
      )}
    </View>
  );
}

import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WorkerSlot } from "./worker-offline-model";

type Props = {
  slot: WorkerSlot | null;
  busy: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  onEdit: () => void;
};

export function WorkerDemoSubmit({ slot, busy, onSubmit, onRetry, onEdit }: Props) {
  const pending = slot?.phase === "pending-demo";
  const confirmed = slot?.phase === "confirmed-demo";
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.note}>Demo only · No data is sent. Task status is unchanged.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {confirmed ? "Demo attempt confirmed on this device" : pending
          ? "Demo retry needed. Confirmation was deliberately withheld. Retry uses the saved attempt and answers."
          : "Simulate submission to save a pending demo attempt on this device."}
      </Text>
      {slot && slot.phase !== "draft" && (
        <>
          <Text selectable style={styles.note}>Attempt ID: {slot.payload.clientAttemptId}</Text>
          <Text selectable style={styles.note}>Task: {slot.payload.taskId}</Text>
          <Text selectable style={styles.note}>Template version: {slot.payload.templateVersionId}</Text>
          <Text style={styles.note}>Saved: {new Date(slot.savedAt).toLocaleString()}</Text>
        </>
      )}
      {confirmed && <Text style={styles.note}>Local confirmation: {new Date(slot.confirmedAt).toLocaleString()}</Text>}
      {!confirmed && (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
          onPress={pending ? onRetry : onSubmit} style={[styles.button, busy && { opacity: 0.6 }]}>
          <Text style={styles.buttonText}>{busy ? "Saving…" : pending ? "Retry demo" : "Simulate submission"}</Text>
        </Pressable>
      )}
      {!pending && !confirmed && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onEdit} style={styles.edit}>
          <Text style={styles.editText}>Edit answers</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  note: { color: "#59617d", fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#4f46e5" },
  buttonText: { color: "#fff", fontWeight: "700" },
  edit: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  editText: { color: "#4f46e5", fontWeight: "700" },
});

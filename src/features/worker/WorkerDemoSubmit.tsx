import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  createDemoAttemptTransport,
  createWorkerSubmitSession,
  type SubmitState,
  type WorkerAnswer,
} from "./worker-submit-session";

type Props = {
  taskId: string;
  templateVersionId: string;
  answers: readonly WorkerAnswer[];
  onEdit: () => void;
};

export function WorkerDemoSubmit({
  taskId,
  templateVersionId,
  answers,
  onEdit,
}: Props) {
  const [session] = useState(() =>
    createWorkerSubmitSession(createDemoAttemptTransport()),
  );
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  function submit() {
    void session.submit(
      () => ({
        clientAttemptId: randomUUID(),
        taskId,
        templateVersionId,
        answers,
      }),
      setState,
    );
  }

  const message =
    state.phase === "idle"
      ? (state.message ?? "Simulate a lost response and retry.")
      : state.phase === "sending"
        ? "Sending demo attempt…"
        : state.phase === "retry"
          ? "Response lost in demo. Retry will reuse the same attempt."
          : "Demo retry confirmed. No record was sent to the server.";

  return (
    <View style={styles.actions}>
      <Text style={styles.note}>Demo only · No data is sent.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {message}
      </Text>

      {state.phase !== "confirmed" && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: state.phase === "sending" }}
          disabled={state.phase === "sending"}
          onPress={submit}
          style={[styles.button, state.phase === "sending" && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {state.phase === "sending"
              ? "Sending…"
              : state.phase === "retry"
                ? "Retry demo"
                : "Simulate submit"}
          </Text>
        </Pressable>
      )}

      {state.phase === "idle" && (
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={styles.edit}
        >
          <Text style={styles.editText}>Edit answers</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  note: { color: "#59617d", fontSize: 14, lineHeight: 21 },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#4f46e5",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  edit: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  editText: { color: "#4f46e5", fontWeight: "700" },
});

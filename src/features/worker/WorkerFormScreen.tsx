import { useState } from "react";

import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { BottomTabInset } from "@/constants/theme";
import type { WorkerTask } from "./demo-worker-task";
import { WorkerDemoSubmit } from "./WorkerDemoSubmit";
import { WorkerBarcodeField } from "./WorkerBarcodeField";

type Answer = {
  fieldId: string;
  value: string | number | boolean;
};

type Draft = Record<string, string | boolean | undefined>;

export default function WorkerFormScreen({ task }: { task: WorkerTask }) {

  const [draft, setDraft] = useState<Draft>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Answer[] | null>(null);

  function updateAnswer(fieldId: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      [fieldId]: value,
    }));

    setErrors([]);
    setPreview(null);
  }

  function previewAnswers() {
    const nextErrors: string[] = [];
    const answers: Answer[] = [];


    for (const field of task.form.fields) {
      const raw = draft[field.id];

      const empty =
        raw === undefined || (typeof raw === "string" && raw.trim() === "");

      if (empty) {
        if (field.required) {
          nextErrors.push(`${field.label} is required.`);
        }

        continue;
      }

      switch (field.type) {
        case "number": {
          const value = typeof raw === "string" ? Number(raw) : NaN;

          if (!Number.isFinite(value)) {
            nextErrors.push(`${field.label} must be a valid number.`);
          } else {
            answers.push({ fieldId: field.id, value });
          }

          break;
        }

        case "yes-no":
          if (typeof raw !== "boolean") {
            nextErrors.push(`Choose Yes or No for ${field.label}.`);
          } else {
            answers.push({ fieldId: field.id, value: raw });
          }

          break;

        case "barcode":
          if (typeof raw === "string") {
            answers.push({ fieldId: field.id, value: raw.trim() });
          } else {
            nextErrors.push(`${field.label} must be text.`);
          }

          break;

        case "short-text":
          if (typeof raw === "string") {
            answers.push({ fieldId: field.id, value: raw.trim() });
          } else {
            nextErrors.push(`${field.label} must be text.`);
          }

          break;

        case "dropdown":
          if (typeof raw === "string" && field.options?.includes(raw)) {
            answers.push({ fieldId: field.id, value: raw });
          } else {
            nextErrors.push(`Choose a valid option for ${field.label}.`);
          }
          break;

        default:
          nextErrors.push("This field is not supported yet.");
      }
    }

    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setPreview(null);
      return;
    }

    Keyboard.dismiss();
    setPreview(answers);
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          key={preview === null ? "capture" : "review"}
        >
          <View>
            <Text style={styles.brand}>SiteTrace</Text>
            <Text style={styles.muted}>Worker workspace</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.badge}>DEMO TASK · {task.status}</Text>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.muted}>{task.form.details.name}</Text>
          </View>

          {preview === null && (
            <View style={styles.card}>
              <Text style={styles.heading}>Complete your form</Text>

              {task.form.fields.map((field) => {
                const value = draft[field.id];
                const choices =
                  field.type === "yes-no"
                    ? [
                        { label: "Yes", value: true },
                        { label: "No", value: false },
                      ]
                    : field.type === "dropdown"
                      ? (field.options ?? []).map((option) => ({
                          label: option,
                          value: option,
                        }))
                      : null;

                return (
                  <View key={field.id} style={styles.field}>
                    
                    <Text style={styles.label}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </Text>

                    {choices !== null ? (
                      <View style={styles.row}>
                        {choices.map((option) => (
                          <Pressable
                            key={option.label}
                            accessibilityRole="radio"
                            accessibilityLabel={`${field.label}: ${option.label}`}
                            accessibilityState={{
                              checked: value === option.value,
                            }}
                            onPress={() => updateAnswer(field.id, option.value)}
                            style={[
                              styles.choice,
                              value === option.value && styles.selected,
                            ]}
                          >
                            <Text style={styles.label}>{option.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : field.type === "barcode" ? (
                      <WorkerBarcodeField
                        label={field.label}
                        value={typeof value === "string" ? value : ""}
                        onChange={(code) => updateAnswer(field.id, code)}
                      />
                    ) : (
                      <TextInput
                        accessibilityLabel={field.label}
                        style={styles.input}
                        value={typeof value === "string" ? value : ""}
                        onChangeText={(text) => updateAnswer(field.id, text)}
                        inputMode={field.type === "number" ? "decimal" : "text"}
                        placeholder={
                          field.type === "number"
                            ? "Enter a reading"
                            : "Enter your answer"
                        }
                        placeholderTextColor="#717995"
                      />
                    )}
                  </View>
                );
              })}

              {errors.length > 0 && (
                <View accessibilityRole="alert">
                  {errors.map((error) => (
                    <Text key={error} style={styles.error}>
                      {error}
                    </Text>
                  ))}
                </View>
              )}

              {task.id === "equipment-check" && (
                <View style={styles.card}>
                  <Text style={styles.label}>Photo evidence</Text>
                  <Text style={styles.muted}>
                    Camera capture is unavailable in this preview.
                  </Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={previewAnswers}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Review submission</Text>
              </Pressable>

              <Text style={styles.muted}>
                Demo only. Review your answers before simulating submission.
              </Text>
            </View>
          )}

          {preview !== null && (
            <View style={styles.card}>
              <Text style={styles.heading}>Review submission</Text>

              {preview.length === 0 && (
                <Text style={styles.muted}>No answers entered.</Text>
              )}

              {preview.map((answer) => (
                <View key={answer.fieldId} style={styles.field}>
                  <Text style={styles.muted}>
                    {
                      task.form.fields.find(
                        (field) => field.id === answer.fieldId,
                      )?.label
                    }
                  </Text>

                  <Text style={styles.label}>
                    {typeof answer.value === "boolean"
                      ? answer.value
                        ? "Yes"
                        : "No"
                      : String(answer.value)}
                  </Text>
                </View>
              ))}

              <WorkerDemoSubmit
                taskId={task.id}
                templateVersionId={task.templateVersionId}
                answers={preview}
                onEdit={() => setPreview(null)}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, backgroundColor: "#f6f7fb" },
  content: {
    padding: 20,
    paddingBottom: BottomTabInset + 24,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  brand: { fontSize: 25, fontWeight: "800", color: "#20223d" },
  muted: { fontSize: 14, lineHeight: 21, color: "#717995" },
  card: {
    padding: 20,
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e5ef",
    backgroundColor: "#ffffff",
  },
  badge: { color: "#4f46e5", fontSize: 12, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", color: "#20223d" },
  heading: { fontSize: 18, fontWeight: "700", color: "#20223d" },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600", color: "#20223d" },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dce1ed",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    color: "#20223d",
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  choice: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dce1ed",
    borderRadius: 10,
  },
  selected: { backgroundColor: "#ecebff", borderColor: "#4f46e5" },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#4f46e5",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  error: { color: "#b42318", fontSize: 14, marginBottom: 6 },
});

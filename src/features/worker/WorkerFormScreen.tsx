import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomTabInset } from "@/constants/theme";
import type { WorkerTask } from "./demo-worker-task";
import { WorkerBarcodeField } from "./WorkerBarcodeField";
import { WorkerDemoSubmit } from "./WorkerDemoSubmit";
import { WorkerEvidenceField } from "./WorkerEvidenceField";
import { validateWorkerDraft, workerIdentity, type DraftValues, type EvidenceSelection,
  type SlotRead, type WorkerAnswer } from "./worker-offline-model";
import { workerOfflineStore } from "./worker-offline-store";

export default function WorkerFormScreen({ task }: { task: WorkerTask }) {
  const [draft, setDraft] = useState<DraftValues>({});
  const [evidence, setEvidence] = useState<EvidenceSelection>(null);
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<readonly WorkerAnswer[] | null>(null);
  const [read, setRead] = useState<SlotRead | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const generation = useRef(0);
  const focused = useRef(false);
  const cameraLock = useRef<string | null>(null);
  const [cameraOwner, setCameraOwner] = useState<string | null>(null);
  const slot = read?.kind === "found" ? read.slot : null;
  const locked = slot !== null && slot.phase !== "draft";

  const applyRead = useCallback((result: SlotRead) => {
    setRead(result);
    if (result.kind === "found") {
      setEvidence(result.slot.evidence ? { kind: "saved", ...result.slot.evidence } : null);
      setEvidenceUri(result.evidenceUri);
      if (result.slot.phase === "draft") { setDraft({ ...result.slot.values }); setPreview(null); }
      else setPreview(result.slot.payload.answers);
    } else if (result.kind === "missing") {
      setDraft({}); setEvidence(null); setEvidenceUri(null); setPreview(null);
    }
  }, []);

  const loadRecord = useCallback(() => {
    const current = ++generation.current;
    setRead(null); setErrors([]); setNotice(""); setDiscardPrompt(false);
    cameraLock.current = null; setCameraOwner(null);
    void workerOfflineStore.read(workerIdentity(task)).then((result) => {
      if (focused.current && current === generation.current) applyRead(result);
    });
  }, [task, applyRead]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    loadRecord();
    return () => {
      focused.current = false; generation.current += 1;
      cameraLock.current = null; setCameraOwner(null);
    };
  }, [loadRecord]));

  function claimCamera(owner: string) {
    if (busyRef.current || cameraLock.current !== null || !focused.current) return false;
    cameraLock.current = owner; setCameraOwner(owner); return true;
  }
  function releaseCamera() { cameraLock.current = null; setCameraOwner(null); }
  function updateAnswer(fieldId: string, value: string | boolean) {
    if (busyRef.current || locked || !focused.current) return;
    setDraft((current) => ({ ...current, [fieldId]: value }));
    setErrors([]); setNotice(""); setPreview(null); setDiscardPrompt(false);
  }
  function updatePhoto(uri: string | null) {
    if (busyRef.current || locked || !focused.current) return;
    setEvidence(uri ? { kind: "temporary", uri } : null); setEvidenceUri(uri);
    setErrors([]); setNotice(""); setPreview(null); setDiscardPrompt(false);
  }
  // Covers both writes and async Review validation before React can disable taps.
  async function perform(action: () => Promise<void>) {
    if (busyRef.current || cameraLock.current !== null || !focused.current) return;
    const current = generation.current;
    busyRef.current = true; setBusy(true); setErrors([]); setNotice("");
    try { await action(); }
    catch (error) {
      if (focused.current && current === generation.current) setErrors([error instanceof Error ? error.message : "Could not save the record. Your inputs are still here. Try again."]);
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function review() {
    const current = generation.current;
    await perform(async () => {
      const result = validateWorkerDraft(task.form.fields, draft);
      if (evidence && !await workerOfflineStore.evidenceAvailable(evidence)) {
        result.errors.push("Photo evidence is missing. Retake or remove the photo.");
      } else if (task.evidencePolicy === "required" && !evidence) {
        result.errors.push(Platform.OS === "web" ? "This task requires a photo. Use a phone for photo capture." : "Photo evidence is required. Take a photo before Review.");
      }
      if (!focused.current || current !== generation.current) return;
      setErrors(result.errors);
      if (result.errors.length === 0) { Keyboard.dismiss(); setPreview(result.answers); }
    });
  }
  async function persist(action: "save" | "queue" | "retry" | "discard") {
    const current = generation.current;
    await perform(async () => {
      const identity = workerIdentity(task);
      if (action === "save") await workerOfflineStore.saveDraft(task, identity, draft, evidence);
      else if (action === "queue") await workerOfflineStore.queue(task, identity, draft, evidence);
      else if (action === "retry") await workerOfflineStore.retry(identity);
      else await workerOfflineStore.discard(identity);
      const result = await workerOfflineStore.read(identity);
      if (!focused.current || current !== generation.current) return;
      applyRead(result); setDiscardPrompt(false);
      if (result.kind === "found" || result.kind === "missing") {
        setNotice(action === "save" ? "Saved on this device" : action === "discard" ? "Draft discarded on this device" : "");
      }
    });
  }
  const disabled = busy || cameraOwner !== null;
  const answers = locked ? slot.payload.answers : preview;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          key={answers === null ? "capture" : "review"}>
          <View><Text style={styles.brand}>SiteTrace</Text><Text style={styles.muted}>Worker workspace · Demo</Text></View>
          <View style={styles.card}>
            <Text style={styles.badge}>DEMO TASK · {task.status}</Text>
            <Text style={styles.title}>{task.title}</Text><Text style={styles.muted}>{task.form.details.name}</Text>
          </View>
          {Platform.OS === "web" && <Text style={styles.muted}>Web preview: saved records reset on reload. Use a phone for photo capture.</Text>}
          {read === null ? <Text accessibilityLiveRegion="polite" style={styles.muted}>Loading saved record…</Text>
            : read.kind === "invalid" || read.kind === "unavailable" ? (
              <View style={styles.card}>
                <Text accessibilityRole="alert" style={styles.error}>{read.message}</Text>
                <Pressable accessibilityRole="button" style={styles.button} onPress={loadRecord}>
                  <Text style={styles.buttonText}>Retry load</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {notice ? <Text accessibilityLiveRegion="polite" style={styles.badge}>{notice}</Text> : null}
                {slot?.phase === "draft" && <Text style={styles.muted}>Saved on this device · {new Date(slot.savedAt).toLocaleString()}</Text>}
                {errors.length > 0 && <View accessibilityRole="alert">{errors.map((error) => <Text key={error} style={styles.error}>{error}</Text>)}</View>}
                {answers === null && !locked ? (
                  <View style={styles.card}>
                    <Text style={styles.heading}>Complete your form</Text>
                    {task.form.fields.map((field) => {
                      const value = draft[field.id];
                      const choices = field.type === "yes-no" ? [{ label: "Yes", value: true }, { label: "No", value: false }]
                        : field.type === "dropdown" ? (field.options ?? []).map((option) => ({ label: option, value: option })) : null;
                      return (
                        <View key={field.id} style={styles.field}>
                          <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
                          {choices !== null ? (
                            <View style={styles.row}>{choices.map((option) => (
                              <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={`${field.label}: ${option.label}`}
                                aria-checked={value === option.value}
                                accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled}
                                onPress={() => updateAnswer(field.id, option.value)} style={[styles.choice, value === option.value && styles.selected]}>
                                <Text style={styles.label}>{option.label}</Text>
                              </Pressable>
                            ))}</View>
                          ) : field.type === "barcode" ? (
                            <WorkerBarcodeField label={field.label} value={typeof value === "string" ? value : ""}
                              disabled={disabled} onChange={(code) => updateAnswer(field.id, code)}
                              cameraEnabled={cameraOwner === field.id} onCameraOpen={() => claimCamera(field.id)} onCameraClose={releaseCamera} />
                          ) : (
                            <TextInput accessibilityLabel={field.label} style={styles.input} editable={!disabled}
                              value={typeof value === "string" ? value : ""} onChangeText={(text) => updateAnswer(field.id, text)}
                              inputMode={field.type === "number" ? "decimal" : "text"}
                              placeholder={field.type === "number" ? "Enter a reading" : "Enter your answer"} placeholderTextColor="#717995" />
                          )}
                        </View>
                      );
                    })}
                    <WorkerEvidenceField uri={evidenceUri} hasEvidence={evidence !== null} required={task.evidencePolicy === "required"}
                      disabled={disabled} onChange={updatePhoto} cameraEnabled={cameraOwner === "photo"}
                      onCameraOpen={() => claimCamera("photo")} onCameraClose={releaseCamera} />
                    <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={() => void persist("save")}>
                      <Text style={styles.buttonText}>{busy ? "Saving…" : "Save draft"}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={() => void review()}>
                      <Text style={styles.buttonText}>Review submission</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={disabled} style={styles.secondary} onPress={() => setDiscardPrompt(true)}>
                      <Text style={styles.label}>Discard draft</Text>
                    </Pressable>
                    {discardPrompt && (
                      <View style={styles.field}>
                        <Text style={styles.error}>Discard answers and photo for this task’s draft on this device?</Text>
                        <Pressable accessibilityRole="button" disabled={disabled} style={styles.secondary} onPress={() => void persist("discard")}>
                          <Text style={styles.error}>Confirm discard</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" disabled={disabled} style={styles.secondary} onPress={() => setDiscardPrompt(false)}>
                          <Text style={styles.label}>Keep draft</Text>
                        </Pressable>
                      </View>
                    )}
                    <Text style={styles.muted}>Incomplete answers can be saved. Unsaved changes are not kept across restart.</Text>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.heading}>{slot?.phase === "confirmed-demo" ? "Demo receipt" : slot?.phase === "pending-demo" ? "Pending demo attempt" : "Review submission"}</Text>
                    {answers?.length === 0 && <Text style={styles.muted}>No answers entered.</Text>}
                    {answers?.map((answer) => (
                      <View key={answer.fieldId} style={styles.field}>
                        <Text style={styles.muted}>{task.form.fields.find((field) => field.id === answer.fieldId)?.label ?? answer.fieldId}</Text>
                        <Text selectable style={styles.label}>{typeof answer.value === "boolean" ? answer.value ? "Yes" : "No" : String(answer.value)}</Text>
                      </View>
                    ))}
                    <WorkerEvidenceField uri={evidenceUri} hasEvidence={evidence !== null} required={task.evidencePolicy === "required"}
                      readOnly disabled onChange={updatePhoto} cameraEnabled={false} onCameraOpen={() => false} onCameraClose={releaseCamera} />
                    <WorkerDemoSubmit slot={slot} busy={busy} onSubmit={() => void persist("queue")} onRetry={() => void persist("retry")}
                      onEdit={() => { if (!busyRef.current && !locked) setPreview(null); }} />
                  </View>
                )}
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, page: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 20, paddingBottom: BottomTabInset + 24, gap: 20, width: "100%", maxWidth: 680, alignSelf: "center" },
  brand: { fontSize: 25, fontWeight: "800", color: "#20223d" },
  muted: { fontSize: 14, lineHeight: 21, color: "#717995" },
  card: { padding: 20, gap: 16, borderRadius: 16, borderWidth: 1, borderColor: "#e1e5ef", backgroundColor: "#fff" },
  badge: { color: "#4f46e5", fontSize: 12, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", color: "#20223d" },
  heading: { fontSize: 18, fontWeight: "700", color: "#20223d" },
  field: { gap: 8 }, label: { fontSize: 15, fontWeight: "600", color: "#20223d" },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#dce1ed", borderRadius: 10, backgroundColor: "#fff", color: "#20223d", fontSize: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  choice: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dce1ed", borderRadius: 10 },
  selected: { backgroundColor: "#ecebff", borderColor: "#4f46e5" },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#4f46e5" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.6 },
  error: { color: "#b42318", fontSize: 14, marginBottom: 6 },
});

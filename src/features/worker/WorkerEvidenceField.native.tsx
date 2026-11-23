import { CameraView, useCameraPermissions } from "expo-camera";
import { isDevice } from "expo-device";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkerEvidencePreview } from "./WorkerEvidencePreview";
import type { WorkerEvidenceProps } from "./worker-camera-props";

export function WorkerEvidenceField({ uri, hasEvidence, required, readOnly, disabled,
  cameraEnabled = true, onChange, onCameraOpen, onCameraClose }: WorkerEvidenceProps) {
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  // CameraView.isAvailableAsync is web-only in the installed SDK. On native,
  // exclude simulators and handle hardware/mount failure in the camera modal.
  const available = isDevice && !cameraUnavailable;
  function close() { setOpen(false); onCameraClose(); }
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>Photo evidence{required ? " *" : " (optional)"}</Text>
      <WorkerEvidencePreview uri={uri} hasEvidence={hasEvidence} />
      {!readOnly && (
        <>
          {available ? (
            <Pressable accessibilityRole="button" disabled={disabled} style={styles.button}
              onPress={() => { if (disabled || !onCameraOpen()) return; Keyboard.dismiss(); setOpen(true); }}>
              <Text style={styles.buttonText}>{hasEvidence ? "Retake" : "Take photo"}</Text>
            </Pressable>
          ) : <Text style={styles.hint}>Photo capture is unavailable on this device. Text entry still works. Use a physical phone for photos.</Text>}
          {hasEvidence && (
            <Pressable accessibilityRole="button" disabled={disabled} style={styles.secondary} onPress={() => onChange(null)}>
              <Text style={styles.label}>Remove photo</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>Photo changes are kept only after Save draft or Simulate submission. Unsaved changes are not kept across restart.</Text>
        </>
      )}
      {open && cameraEnabled && !readOnly && (
        <EvidenceCamera onClose={close} onUnavailable={() => setCameraUnavailable(true)} onCapture={(next) => { onChange(next); close(); }} />
      )}
    </View>
  );
}

function EvidenceCamera({ onClose, onCapture, onUnavailable }: { onClose: () => void; onCapture: (uri: string) => void; onUnavailable: () => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mountFailed, setMountFailed] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function close() { active.current = false; onClose(); }
  async function allow() {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await requestPermission(); }
    catch { if (active.current) setNotice("Could not request camera access. Close and try again."); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function capture() {
    if (locked.current || !ready || !camera.current) return;
    locked.current = true; setBusy(true); setNotice("");
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.5, exif: false, base64: false });
      if (active.current) onCapture(photo.uri);
    } catch { if (active.current) setNotice("Could not take the photo. Try again or cancel."); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.page}>
        <Text style={styles.title}>Take evidence photo</Text>
        {permission?.granted && !mountFailed ? (
          <CameraView ref={camera} style={styles.camera} facing="back" mode="picture"
            onCameraReady={() => setReady(true)}
            onMountError={() => { setReady(false); setMountFailed(true); onUnavailable(); setNotice("Camera unavailable. Close to return to the form."); }} />
        ) : (
          <Text style={styles.hint}>{permission === null ? "Checking camera access…" : permission.granted ? "Camera unavailable."
            : permission.canAskAgain ? "Allow camera access to take a test photo." : "Camera access is blocked. Enable it in Settings. You can still enter answers."}</Text>
        )}
        {notice ? <Text accessibilityRole="alert" style={styles.error}>{notice}</Text> : null}
        {permission && !permission.granted && permission.canAskAgain && (
          <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void allow()}>
            <Text style={styles.buttonText}>{busy ? "Requesting access…" : "Allow camera"}</Text>
          </Pressable>
        )}
        {permission?.granted && !mountFailed && (
          <Pressable accessibilityRole="button" disabled={!ready || busy} accessibilityState={{ disabled: !ready || busy }}
            style={[styles.button, (!ready || busy) && { opacity: 0.5 }]} onPress={() => void capture()}>
            <Text style={styles.buttonText}>{busy ? "Taking photo…" : ready ? "Capture photo" : "Preparing camera…"}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={close}><Text style={styles.label}>Cancel</Text></Pressable>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, gap: 16, backgroundColor: "#f6f7fb" },
  camera: { flex: 1, backgroundColor: "#20223d" },
  title: { fontSize: 22, fontWeight: "700", color: "#20223d" },
  label: { fontSize: 15, fontWeight: "600", color: "#20223d" },
  hint: { color: "#59617d", lineHeight: 21 },
  error: { color: "#b42318" },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#4f46e5" },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});

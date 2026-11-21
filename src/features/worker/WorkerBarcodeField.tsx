import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function WorkerBarcodeField({ label, value, onChange }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        placeholder="Enter or scan a code"
        placeholderTextColor="#717995"
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChange}
      />

      {Platform.OS === "web" ? (
        <Text style={styles.hint}>Type the code to continue on web.</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Scan ${label}`}
          style={styles.button}
          onPress={() => {
            Keyboard.dismiss();
            setScannerOpen(true);
          }}
        >
          <Text style={styles.buttonText}>Scan barcode</Text>
        </Pressable>
      )}

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onScan={(code) => {
            onChange(code);
            setScannerOpen(false);
          }}
        />
      )}
    </View>
  );
}

type ScannerProps = {
  onClose: () => void;
  onScan: (code: string) => void;
};

function BarcodeScanner({ onClose, onScan }: ScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState("");
  const finished = useRef(false);

  function close() {
    finished.current = true;
    onClose();
  }

  async function allowCamera() {
    setRequesting(true);
    setNotice("");

    try {
      await requestPermission();
    } catch {
      setNotice("Could not request camera access. Enter the code manually.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.page}>
        <Text style={styles.title}>Scan barcode</Text>

        {permission?.granted && !notice ? (
          <>
            <Text style={styles.hint}>
              Point the camera at the equipment label.
            </Text>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["code128", "code39", "ean13", "ean8"],
              }}
              onMountError={() => {
                finished.current = true;
                setNotice("Camera unavailable. Enter the code manually.");
              }}
              onBarcodeScanned={({ data }) => {
                if (finished.current || !data.trim()) return;

                // One barcode can trigger several events before the modal closes.
                finished.current = true;
                onScan(data);
              }}
            />
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {notice ||
              (permission === null
                ? "Checking camera access…"
                : permission.canAskAgain
                  ? "Allow camera access to scan the label."
                  : "Camera access is blocked. Enable it in Settings or type the code.")}
          </Text>
        )}

        {permission && !permission.granted && permission.canAskAgain && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: requesting }}
            disabled={requesting}
            style={[styles.button, requesting && { opacity: 0.6 }]}
            onPress={() => void allowCamera()}
          >
            <Text style={styles.buttonText}>
              {requesting ? "Requesting access…" : "Allow camera"}
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          style={styles.secondary}
          onPress={close}
        >
          <Text style={styles.secondaryText}>Back to manual entry</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  page: { flex: 1, padding: 20, gap: 16, backgroundColor: "#f6f7fb" },
  title: { fontSize: 22, fontWeight: "700", color: "#20223d" },
  hint: { color: "#59617d", lineHeight: 21 },
  camera: { flex: 1, backgroundColor: "#20223d" },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dce1ed",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#20223d",
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#4f46e5",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#4f46e5", fontWeight: "700" },
});

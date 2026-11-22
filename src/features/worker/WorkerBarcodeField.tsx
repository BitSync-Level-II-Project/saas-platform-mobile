import { StyleSheet, Text, TextInput, View } from "react-native";
import type { WorkerBarcodeProps } from "./worker-camera-props";

export function WorkerBarcodeField({ label, value, onChange, disabled }: WorkerBarcodeProps) {
  return (
    <View style={{ gap: 8 }}>
      <TextInput accessibilityLabel={label} style={styles.input} placeholder="Enter a code"
        placeholderTextColor="#717995" autoCapitalize="none" autoCorrect={false}
        editable={!disabled} value={value} onChangeText={onChange} />
      <Text style={{ color: "#59617d" }}>Type the code to continue on web.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: "#dce1ed",
    borderRadius: 10, backgroundColor: "#fff", color: "#20223d", fontSize: 16 },
});

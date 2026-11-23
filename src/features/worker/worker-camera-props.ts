export type WorkerCameraControls = {
  disabled?: boolean;
  cameraEnabled?: boolean;
  onCameraOpen: () => boolean;
  onCameraClose: () => void;
};
export type WorkerBarcodeProps = WorkerCameraControls & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
export type WorkerEvidenceProps = WorkerCameraControls & {
  uri: string | null;
  hasEvidence: boolean;
  required: boolean;
  readOnly?: boolean;
  onChange: (uri: string | null) => void;
};

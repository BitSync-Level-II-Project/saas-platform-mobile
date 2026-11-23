import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import Storage from "expo-sqlite/kv-store";

import { createWorkerOfflineStore, isEvidenceBasename, type LocalEvidence, type WorkerOfflineStore } from "./worker-offline-model";

function evidenceDirectory() {
  return new Directory(Paths.document, "worker-demo-evidence");
}
function evidenceFile(evidence: LocalEvidence) {
  if (!isEvidenceBasename(evidence.fileName)) throw new Error("Invalid evidence filename.");
  return new File(evidenceDirectory(), evidence.fileName);
}

export const workerOfflineStore: WorkerOfflineStore = createWorkerOfflineStore({
  storage: Storage,
  randomUUID,
  files: {
    async copyTemporary(uri) {
      const source = new File(uri);
      if (!source.exists) throw new Error("The photo is no longer available. Please retake it.");
      const directory = evidenceDirectory();
      await directory.create({ idempotent: true, intermediates: true });
      const evidence = { fileName: `evidence-${randomUUID()}.jpg` };
      const destination = evidenceFile(evidence);
      if (destination.exists) throw new Error("Could not prepare a unique photo file. Please try again.");
      try {
        await source.copy(destination);
        if (!destination.exists) throw new Error("Could not keep the photo on this device.");
      } catch (error) {
        // This unique destination has never been committed to a record.
        try { if (destination.exists) await destination.delete(); } catch { /* Leave orphan. */ }
        throw error;
      }
      return evidence;
    },
    async resolve(evidence) {
      const file = evidenceFile(evidence);
      return file.exists ? file.uri : null;
    },
    async temporaryAvailable(uri) { return new File(uri).exists; },
    async remove(evidence) {
      const file = evidenceFile(evidence);
      if (file.exists) await file.delete();
    },
  },
});

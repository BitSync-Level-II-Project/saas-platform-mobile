import { randomUUID } from "expo-crypto";

import { createWorkerOfflineStore, type WorkerOfflineStore } from "./worker-offline-model";

// Browser preview deliberately has no native SQLite, file system or camera imports.
const records = new Map<string, string>();
export const workerOfflineStore: WorkerOfflineStore = createWorkerOfflineStore({
  storage: {
    async getItem(key) { return records.get(key) ?? null; },
    async setItem(key, value) { records.set(key, value); },
    async removeItem(key) { records.delete(key); },
  },
  randomUUID,
  files: {
    async copyTemporary() { throw new Error("Use a phone for photo capture."); },
    async resolve() { return null; },
    async temporaryAvailable() { return false; },
    async remove() {},
  },
});

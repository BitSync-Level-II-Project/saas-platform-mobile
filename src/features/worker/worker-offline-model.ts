import type { WorkerField, WorkerTask } from "./demo-worker-task.ts";

export type AnswerValue = string | number | boolean;
export type DraftValues = Record<string, string | boolean>;
export type WorkerAnswer = Readonly<{ fieldId: string; value: AnswerValue }>;
export type AttemptPayload = Readonly<{
  clientAttemptId: string;
  taskId: string;
  templateVersionId: string;
  answers: readonly WorkerAnswer[];
}>;
export type LocalEvidence = { fileName: string };
export type EvidenceSelection =
  | { kind: "saved"; fileName: string }
  | { kind: "temporary"; uri: string }
  | null;
type SlotBase = {
  schemaVersion: 1;
  taskId: string;
  templateVersionId: string;
  savedAt: string;
  evidence: LocalEvidence | null;
};
export type WorkerSlot =
  | (SlotBase & { phase: "draft"; values: DraftValues })
  | (SlotBase & { phase: "pending-demo"; payload: AttemptPayload })
  | (SlotBase & { phase: "confirmed-demo"; payload: AttemptPayload; confirmedAt: string });

export type SlotIdentity = {
  workspaceId: string;
  taskId: string;
  templateVersionId: string;
};
export const DEMO_WORKSPACE = "sitetrace-worker-demo";
export function workerIdentity(task: Pick<WorkerTask, "id" | "templateVersionId">): SlotIdentity {
  return { workspaceId: DEMO_WORKSPACE, taskId: task.id, templateVersionId: task.templateVersionId };
}
export function workerSlotKey(identity: SlotIdentity) {
  return ["worker-slot", identity.workspaceId, identity.taskId, identity.templateVersionId]
    .map(encodeURIComponent).join("/");
}
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isEvidenceBasename(value: unknown): value is string {
  return typeof value === "string" && /^evidence-[0-9a-f-]{36}\.jpg$/i.test(value)
    && uuidV4.test(value.slice(9, -4));
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validValues(value: unknown): value is DraftValues {
  return object(value) && Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "boolean");
}
function validAnswers(value: unknown): value is WorkerAnswer[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((answer: unknown) => {
    if (!object(answer) || typeof answer.fieldId !== "string" || !answer.fieldId || ids.has(answer.fieldId)) return false;
    ids.add(answer.fieldId);
    return typeof answer.value === "string" || typeof answer.value === "boolean"
      || (typeof answer.value === "number" && Number.isFinite(answer.value));
  });
}
export function snapshotAttempt(input: AttemptPayload): AttemptPayload {
  return Object.freeze({
    clientAttemptId: input.clientAttemptId,
    taskId: input.taskId,
    templateVersionId: input.templateVersionId,
    answers: Object.freeze(input.answers.map((answer) => Object.freeze({ ...answer }))),
  });
}
export type DecodedSlot = { kind: "missing" } | { kind: "invalid"; message: string } | { kind: "found"; slot: WorkerSlot };
export function decodeWorkerSlot(raw: string | null, identity: SlotIdentity): DecodedSlot {
  if (raw === null) return { kind: "missing" };
  const invalid = { kind: "invalid", message: "The saved record is invalid. It has been kept and cannot be overwritten." } as const;
  try {
    const slot: unknown = JSON.parse(raw);
    if (!object(slot) || slot.schemaVersion !== 1 || slot.taskId !== identity.taskId
      || slot.templateVersionId !== identity.templateVersionId || !timestamp(slot.savedAt)
      || !(slot.evidence === null || (object(slot.evidence) && isEvidenceBasename(slot.evidence.fileName)))) return invalid;
    const base: SlotBase = {
      schemaVersion: 1, taskId: identity.taskId, templateVersionId: identity.templateVersionId,
      savedAt: slot.savedAt, evidence: slot.evidence === null ? null : { fileName: slot.evidence.fileName as string },
    };
    if (slot.phase === "draft" && validValues(slot.values)) {
      return { kind: "found", slot: { ...base, phase: "draft", values: { ...slot.values } } };
    }
    const payload = slot.payload;
    if (!object(payload) || typeof payload.clientAttemptId !== "string" || !uuidV4.test(payload.clientAttemptId)
      || payload.taskId !== identity.taskId || payload.templateVersionId !== identity.templateVersionId
      || !validAnswers(payload.answers)) return invalid;
    const frozen = snapshotAttempt({ clientAttemptId: payload.clientAttemptId,
      taskId: identity.taskId, templateVersionId: identity.templateVersionId, answers: payload.answers });
    if (slot.phase === "pending-demo") return { kind: "found", slot: { ...base, phase: "pending-demo", payload: frozen } };
    if (slot.phase === "confirmed-demo" && timestamp(slot.confirmedAt)) {
      return { kind: "found", slot: { ...base, phase: "confirmed-demo", payload: frozen, confirmedAt: slot.confirmedAt } };
    }
    return invalid;
  } catch { return invalid; }
}

// Drafts retain raw input. Only Review turns numeric text into numbers.
export function validateWorkerDraft(fields: readonly WorkerField[], values: DraftValues) {
  const errors: string[] = [];
  const answers: WorkerAnswer[] = [];
  for (const field of fields) {
    const raw = values[field.id];
    if (raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
      if (field.required) errors.push(`${field.label} is required.`);
      continue;
    }
    if (field.type === "number") {
      const value = typeof raw === "string" ? Number(raw) : NaN;
      if (!Number.isFinite(value)) errors.push(`${field.label} must be a valid number.`);
      else answers.push({ fieldId: field.id, value });
    } else if (field.type === "yes-no") {
      if (typeof raw !== "boolean") errors.push(`Choose Yes or No for ${field.label}.`);
      else answers.push({ fieldId: field.id, value: raw });
    } else if (typeof raw !== "string") {
      errors.push(`${field.label} must be text.`);
    } else if (field.type === "dropdown" && !field.options?.includes(raw)) {
      errors.push(`Choose a valid option for ${field.label}.`);
    } else {
      answers.push({ fieldId: field.id, value: raw.trim() });
    }
  }
  return { errors, answers };
}

export type KeyValueAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type EvidenceAdapter = {
  copyTemporary(uri: string): Promise<LocalEvidence>;
  temporaryAvailable(uri: string): Promise<boolean>;
  resolve(evidence: LocalEvidence): Promise<string | null>;
  remove(evidence: LocalEvidence): Promise<void>;
};
export type SlotRead = Exclude<DecodedSlot, { kind: "found" }>
  | { kind: "unavailable"; message: string }
  | { kind: "found"; slot: WorkerSlot; evidenceUri: string | null; evidenceMissing: boolean };

// All instances sharing an adapter also share locks, including separate screens.
const adapterLocks = new WeakMap<KeyValueAdapter, Map<string, Promise<unknown>>>();
export function createWorkerOfflineStore(options: {
  storage: KeyValueAdapter;
  files: EvidenceAdapter;
  randomUUID: () => string;
  now?: () => string;
}) {
  const { storage, files, randomUUID } = options;
  const now = options.now ?? (() => new Date().toISOString());
  let locks = adapterLocks.get(storage);
  if (!locks) { locks = new Map(); adapterLocks.set(storage, locks); }
  const sharedLocks = locks;
  function mutate<T>(identity: SlotIdentity, action: () => Promise<T>): Promise<T> {
    const key = workerSlotKey(identity);
    const previous = sharedLocks.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    sharedLocks.set(key, next);
    void next.finally(() => { if (sharedLocks.get(key) === next) sharedLocks.delete(key); }).catch(() => {});
    return next;
  }
  async function cleanup(evidence: LocalEvidence | null) {
    if (evidence) { try { await files.remove(evidence); } catch { /* Orphan is safer than losing a committed attachment. */ } }
  }
  async function resolve(evidence: LocalEvidence | null) {
    if (!evidence) return null;
    try { return await files.resolve(evidence); } catch { return null; }
  }
  async function read(identity: SlotIdentity): Promise<SlotRead> {
    try {
      const decoded = decodeWorkerSlot(await storage.getItem(workerSlotKey(identity)), identity);
      if (decoded.kind !== "found") return decoded;
      const evidenceUri = await resolve(decoded.slot.evidence);
      return { ...decoded, evidenceUri, evidenceMissing: decoded.slot.evidence !== null && evidenceUri === null };
    } catch {
      return { kind: "unavailable", message: "Cannot read the saved record. Retry load before making changes." };
    }
  }
  async function latest(identity: SlotIdentity) {
    const raw = await storage.getItem(workerSlotKey(identity));
    const decoded = decodeWorkerSlot(raw, identity);
    if (decoded.kind === "invalid") throw new Error(decoded.message);
    return { raw, slot: decoded.kind === "found" ? decoded.slot : null };
  }
  function editable(slot: WorkerSlot | null) {
    if (slot && slot.phase !== "draft") throw new Error("This demo attempt is read-only. Reload to view it.");
  }
  async function prepareEvidence(selection: EvidenceSelection, old: WorkerSlot | null) {
    if (!selection) return null;
    if (selection.kind === "saved") {
      if (!isEvidenceBasename(selection.fileName) || selection.fileName !== old?.evidence?.fileName) {
        throw new Error("The selected saved photo does not belong to this record. Reload it.");
      }
      return { fileName: selection.fileName };
    }
    return files.copyTemporary(selection.uri);
  }
  async function commit(identity: SlotIdentity, oldRaw: string | null, old: WorkerSlot | null, slot: WorkerSlot) {
    const added = slot.evidence && slot.evidence.fileName !== old?.evidence?.fileName ? slot.evidence : null;
    try {
      await storage.setItem(workerSlotKey(identity), JSON.stringify(slot));
    } catch (error) {
      // A failed promise may have an uncertain outcome. Delete only when a read
      // proves the old record is intact and the new copy is unreferenced.
      try { if (await storage.getItem(workerSlotKey(identity)) === oldRaw) await cleanup(added); } catch { /* Keep uncertain copy. */ }
      throw error;
    }
    if (old?.evidence?.fileName !== slot.evidence?.fileName) await cleanup(old?.evidence ?? null);
    return slot;
  }
  async function persist(task: WorkerTask, identity: SlotIdentity, values: DraftValues, selection: EvidenceSelection, queue: boolean) {
    const { raw, slot: old } = await latest(identity);
    if (queue && old && old.phase !== "draft") return old;
    editable(old);
    if (identity.taskId !== task.id || identity.templateVersionId !== task.templateVersionId
      || task.form.versionId !== task.templateVersionId || !validValues(values)) throw new Error("The task form is unavailable.");
    const reviewed = validateWorkerDraft(task.form.fields, values);
    if (queue && reviewed.errors.length) throw new Error(reviewed.errors.join("\n"));
    // Generate before copying so UUID errors cannot strand a new attachment.
    const clientAttemptId = queue ? randomUUID() : null;
    if (clientAttemptId !== null && !uuidV4.test(clientAttemptId)) throw new Error("Could not create a demo attempt ID.");
    const evidence = await prepareEvidence(selection, old);
    if (queue && ((evidence && !await resolve(evidence)) || (task.evidencePolicy === "required" && !evidence))) {
      if (evidence?.fileName !== old?.evidence?.fileName) await cleanup(evidence);
      throw new Error("Photo evidence is missing. Reattach a photo before simulating submission.");
    }
    const base: SlotBase = { schemaVersion: 1, taskId: identity.taskId, templateVersionId: identity.templateVersionId, savedAt: now(), evidence };
    const slot: WorkerSlot = clientAttemptId === null
      ? { ...base, phase: "draft", values: { ...values } }
      : { ...base, phase: "pending-demo", payload: snapshotAttempt({ clientAttemptId, taskId: identity.taskId,
        templateVersionId: identity.templateVersionId, answers: reviewed.answers }) };
    return commit(identity, raw, old, slot);
  }
  return {
    read: (identity: SlotIdentity) => mutate(identity, () => read(identity)),
    async evidenceAvailable(selection: EvidenceSelection) {
      if (!selection) return false;
      if (selection.kind === "temporary") {
        try { return await files.temporaryAvailable(selection.uri); } catch { return false; }
      }
      return await resolve({ fileName: selection.fileName }) !== null;
    },
    saveDraft(task: WorkerTask, identity: SlotIdentity, values: DraftValues, selection: EvidenceSelection) {
      const snapshot = { ...values };
      return mutate(identity, () => persist(task, identity, snapshot, selection, false));
    },
    queue(task: WorkerTask, identity: SlotIdentity, values: DraftValues, selection: EvidenceSelection) {
      const snapshot = { ...values };
      return mutate(identity, () => persist(task, identity, snapshot, selection, true));
    },
    discard(identity: SlotIdentity) {
      return mutate(identity, async () => {
        const { slot } = await latest(identity);
        editable(slot);
        await storage.removeItem(workerSlotKey(identity));
        await cleanup(slot?.evidence ?? null);
      });
    },
    retry(identity: SlotIdentity) {
      return mutate(identity, async () => {
        const { slot } = await latest(identity);
        if (!slot || slot.phase === "draft") throw new Error("No pending demo attempt. Reload the record.");
        if (slot.phase === "confirmed-demo") return slot;
        if (slot.evidence && !await resolve(slot.evidence)) throw new Error("Saved photo is missing. The demo attempt remains pending and read-only.");
        const confirmed: WorkerSlot = { ...slot, phase: "confirmed-demo", confirmedAt: now() };
        await storage.setItem(workerSlotKey(identity), JSON.stringify(confirmed));
        return confirmed;
      });
    },
  };
}
export type WorkerOfflineStore = ReturnType<typeof createWorkerOfflineStore>;

export function localRecordLabel(read: SlotRead | undefined) {
  if (!read) return "Checking saved record…";
  if (read.kind === "invalid") return "Invalid saved record";
  if (read.kind === "unavailable") return "Saved record unavailable";
  if (read.kind !== "found") return null;
  return read.slot.phase === "draft" ? "Saved draft" : read.slot.phase === "pending-demo" ? "Demo retry needed" : "Demo confirmed on this device";
}

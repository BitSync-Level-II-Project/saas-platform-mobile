import assert from "node:assert/strict";
import test from "node:test";

import { demoWorkerTasks } from "../src/features/worker/demo-worker-task.ts";
import {
  createWorkerOfflineStore, decodeWorkerSlot, validateWorkerDraft, workerIdentity, workerSlotKey,
} from "../src/features/worker/worker-offline-model.ts";

const task = demoWorkerTasks[0];
const requiredTask = demoWorkerTasks[1];
const identity = workerIdentity(task);
const values = { "equipment-code": "001234", condition: "Good", temperature: "0", note: " test " };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function harness() {
  const records = new Map();
  const images = new Set();
  const events = [];
  let attempts = 0;
  let photos = 0;
  let clock = 0;
  const failure = { read: false, write: false, copy: false, removeSlot: false, deletePhoto: false, uncertainWrite: false, temporaryMissing: false };
  const storage = {
    async getItem(key) {
      if (failure.read) throw new Error("read unavailable");
      return records.get(key) ?? null;
    },
    async setItem(key, value) {
      events.push("commit");
      if (failure.write) throw new Error("disk full");
      records.set(key, value);
      if (failure.uncertainWrite) throw new Error("uncertain commit");
    },
    async removeItem(key) {
      events.push("discard");
      if (failure.removeSlot) throw new Error("cannot discard");
      records.delete(key);
    },
  };
  const files = {
    async copyTemporary() {
      events.push("copy");
      if (failure.copy) throw new Error("copy failed");
      const fileName = `evidence-${uuid(++photos)}.jpg`;
      images.add(fileName);
      return { fileName };
    },
    async resolve({ fileName }) { return images.has(fileName) ? `file:///documents/worker-demo-evidence/${fileName}` : null; },
    async temporaryAvailable() { return !failure.temporaryMissing; },
    async remove({ fileName }) {
      events.push(`delete:${fileName}`);
      if (failure.deletePhoto) throw new Error("delete failed");
      images.delete(fileName);
    },
  };
  const fresh = () => createWorkerOfflineStore({ storage, files, randomUUID: () => uuid(++attempts), now: () => new Date(1_700_000_000_000 + clock++).toISOString() });
  return { records, images, events, failure, fresh, store: fresh(), attemptCount: () => attempts };
}
const photo = { kind: "temporary", uri: "file:///cache/test.jpg" };
function draftSlot(overrides = {}) {
  return { schemaVersion: 1, taskId: identity.taskId, templateVersionId: identity.templateVersionId,
    savedAt: "2026-11-22T08:00:00.000Z", evidence: null, phase: "draft", values: {}, ...overrides };
}

test("decode valid draft and reject corrupt or mismatched records without modifying them", async () => {
  const h = harness();
  assert.equal(decodeWorkerSlot(null, identity).kind, "missing");
  assert.equal(decodeWorkerSlot(JSON.stringify(draftSlot()), identity).kind, "found");
  const badRecords = [
    "{", "null", "[]", JSON.stringify(draftSlot({ schemaVersion: 2 })),
    JSON.stringify(draftSlot({ taskId: "wrong" })), JSON.stringify(draftSlot({ templateVersionId: "wrong" })),
    JSON.stringify(draftSlot({ phase: "other" })), JSON.stringify(draftSlot({ savedAt: "invalid" })),
    JSON.stringify(draftSlot({ values: { count: 3 } })), JSON.stringify(draftSlot({ values: { code: null } })),
    JSON.stringify(draftSlot({ evidence: { fileName: "../photo.jpg" } })),
    JSON.stringify(draftSlot({ evidence: { fileName: "file:///photo.jpg" } })),
    JSON.stringify(draftSlot({ evidence: { fileName: `evidence-${uuid(1)}.jpg/elsewhere` } })),
  ];
  for (const raw of badRecords) {
    h.records.set(workerSlotKey(identity), raw);
    assert.equal((await h.store.read(identity)).kind, "invalid");
    await assert.rejects(h.store.saveDraft(task, identity, {}, null), /invalid/);
    await assert.rejects(h.store.discard(identity), /invalid/);
    await assert.rejects(h.store.queue(task, identity, values, null), /invalid/);
    await assert.rejects(h.store.retry(identity), /invalid/);
    assert.equal(h.records.get(workerSlotKey(identity)), raw);
  }
});

test("pending payload decoder rejects wrong identity, malformed UUID, duplicate fields and invalid typed answers", async () => {
  const h = harness();
  const pending = await h.store.queue(task, identity, values, null);
  for (const payload of [
    { ...pending.payload, taskId: "other" }, { ...pending.payload, templateVersionId: "other" },
    { ...pending.payload, clientAttemptId: "not-a-uuid" }, { ...pending.payload, answers: [{ fieldId: "count", value: null }] },
    { ...pending.payload, answers: [{ fieldId: "x", value: {} }] }, { ...pending.payload, answers: [{ fieldId: 2, value: 0 }] },
    { ...pending.payload, answers: [{ fieldId: "x", value: true }, { fieldId: "x", value: false }] },
  ]) assert.equal(decodeWorkerSlot(JSON.stringify({ ...pending, payload }), identity).kind, "invalid");
  assert.equal(decodeWorkerSlot(JSON.stringify({ ...pending, phase: "confirmed-demo", confirmedAt: "bad" }), identity).kind, "invalid");
});

test("incomplete raw drafts survive a fresh repository; barcode zeros and false are preserved", async () => {
  const h = harness();
  const partial = { "equipment-code": "0000123", temperature: "", extra: false };
  await h.store.saveDraft(task, identity, partial, null);
  const restored = await h.fresh().read(identity);
  assert.equal(restored.kind, "found");
  assert.deepEqual(restored.slot.values, partial);
  assert.ok(validateWorkerDraft(task.form.fields, restored.slot.values).errors.includes("Condition is required."));
  await assert.rejects(h.store.queue(task, identity, partial, null), /required/);
  assert.equal((await h.store.read(identity)).slot.phase, "draft");
  const id = workerIdentity(requiredTask);
  await h.store.saveDraft(requiredTask, id, { "entrance-clear": false }, null);
  assert.equal((await h.fresh().read(id)).slot.values["entrance-clear"], false);
});

test("Review keeps typed zeros and false, validates numbers, required fields and dropdown choices", () => {
  const valid = validateWorkerDraft(task.form.fields, values);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.answers.find((a) => a.fieldId === "equipment-code").value, "001234");
  assert.equal(valid.answers.find((a) => a.fieldId === "temperature").value, 0);
  assert.equal(validateWorkerDraft(requiredTask.form.fields, { "entrance-clear": false }).answers[0].value, false);
  assert.ok(validateWorkerDraft(task.form.fields, {}).errors.length > 0);
  for (const temperature of ["Infinity", "NaN", "not a number"]) {
    assert.match(validateWorkerDraft(task.form.fields, { ...values, temperature }).errors[0], /valid number/);
  }
  assert.match(validateWorkerDraft(task.form.fields, { ...values, condition: "unknown" }).errors[0], /valid option/);
});

test("restart restores pending snapshot; retry and repeated confirmations keep exactly one ID and receipt", async () => {
  const h = harness();
  const original = { ...values };
  const queued = await h.store.queue(task, identity, original, null);
  assert.equal(queued.phase, "pending-demo");
  original["equipment-code"] = "changed";
  original.temperature = "99";
  const restarted = h.fresh();
  const pending = (await restarted.read(identity)).slot;
  assert.deepEqual(pending.payload, queued.payload);
  assert.equal(pending.phase, "pending-demo");
  assert.equal(pending.payload.answers[0].value, "001234");
  assert.ok(Object.isFrozen(pending.payload.answers[0]));
  const confirmed = await restarted.retry(identity);
  assert.equal(confirmed.phase, "confirmed-demo");
  assert.deepEqual(confirmed.payload, queued.payload);
  assert.deepEqual(await h.fresh().retry(identity), confirmed);
  assert.deepEqual(await restarted.queue(task, identity, values, null), confirmed);
  assert.equal(h.attemptCount(), 1);
});

test("parallel queue taps across repository instances serialize; retries confirm once", async () => {
  const h = harness();
  const other = h.fresh();
  const queued = await Promise.all([h.store.queue(task, identity, values, null), other.queue(task, identity, values, null)]);
  assert.deepEqual(queued[0], queued[1]);
  assert.equal(h.attemptCount(), 1);
  const confirmed = await Promise.all([h.store.retry(identity), other.retry(identity), h.store.retry(identity)]);
  assert.deepEqual(confirmed[0], confirmed[1]);
  assert.deepEqual(confirmed[1], confirmed[2]);
  assert.equal(h.attemptCount(), 1);
});

test("workspace, task and exact version keys cannot collide; discard isolates the requested draft", async () => {
  const h = harness();
  const second = workerIdentity(requiredTask);
  const nextTask = { ...task, templateVersionId: "new-version", form: { ...task.form, versionId: "new-version" } };
  const next = workerIdentity(nextTask);
  const workspace = { ...identity, workspaceId: "other-workspace" };
  await h.store.saveDraft(task, identity, values, photo);
  await h.store.saveDraft(requiredTask, second, { "entrance-clear": false }, null);
  await h.store.saveDraft(nextTask, next, {}, null);
  await h.store.saveDraft(task, workspace, {}, null);
  await h.store.discard(second);
  assert.equal((await h.store.read(second)).kind, "missing");
  assert.deepEqual((await h.store.read(identity)).slot.values, values);
  assert.equal((await h.store.read(next)).kind, "found");
  assert.equal((await h.store.read(workspace)).kind, "found");
  assert.equal(h.images.size, 1);
  assert.notEqual(workerSlotKey({ workspaceId: "a/b", taskId: "c", templateVersionId: "d" }), workerSlotKey({ workspaceId: "a", taskId: "b/c", templateVersionId: "d" }));
});

test("pending and confirmed records reject draft saving/discarding and retain attachments", async () => {
  const h = harness();
  await h.store.queue(task, identity, values, photo);
  for (const phase of ["pending-demo", "confirmed-demo"]) {
    const previous = h.records.get(workerSlotKey(identity));
    await assert.rejects(h.store.saveDraft(task, identity, {}, null), /read-only/);
    await assert.rejects(h.store.discard(identity), /read-only/);
    assert.equal(h.records.get(workerSlotKey(identity)), previous);
    assert.equal((await h.store.read(identity)).slot.phase, phase);
    assert.equal(h.images.size, 1);
    if (phase === "pending-demo") await h.store.retry(identity);
  }
});

test("replacement copies before commit and deletes old image only after success", async () => {
  const h = harness();
  const first = await h.store.saveDraft(task, identity, {}, photo);
  h.events.length = 0;
  const second = await h.store.saveDraft(task, identity, values, photo);
  assert.deepEqual(h.events, ["copy", "commit", `delete:${first.evidence.fileName}`]);
  assert.equal(h.images.has(first.evidence.fileName), false);
  assert.equal(h.images.has(second.evidence.fileName), true);
  h.events.length = 0;
  await h.store.saveDraft(task, identity, values, null);
  assert.deepEqual(h.events, ["commit", `delete:${second.evidence.fileName}`]);
});

test("failed commit preserves saved inputs and old image, cleaning only unreferenced new copy", async () => {
  const h = harness();
  const first = await h.store.saveDraft(task, identity, values, photo);
  const previous = h.records.get(workerSlotKey(identity));
  h.failure.write = true;
  await assert.rejects(h.store.saveDraft(task, identity, {}, photo), /disk full/);
  assert.equal(h.records.get(workerSlotKey(identity)), previous);
  assert.deepEqual([...h.images], [first.evidence.fileName]);
  assert.equal((await h.fresh().read(identity)).evidenceMissing, false);
  await assert.rejects(h.store.saveDraft(task, identity, {}, null), /disk full/);
  assert.equal(h.images.has(first.evidence.fileName), true);
});

test("copy failure leaves old slot and image usable; failed cleanup does not undo a committed record", async () => {
  const h = harness();
  const first = await h.store.saveDraft(task, identity, {}, photo);
  const previous = h.records.get(workerSlotKey(identity));
  h.failure.copy = true;
  await assert.rejects(h.store.saveDraft(task, identity, values, photo), /copy failed/);
  assert.equal(h.records.get(workerSlotKey(identity)), previous);
  assert.equal(h.images.has(first.evidence.fileName), true);
  h.failure.copy = false; h.failure.deletePhoto = true;
  const second = await h.store.saveDraft(task, identity, values, photo);
  assert.equal((await h.store.read(identity)).slot.evidence.fileName, second.evidence.fileName);
});

test("uncertain write never deletes a photo that may already be committed", async () => {
  const h = harness();
  h.failure.uncertainWrite = true;
  await assert.rejects(h.store.saveDraft(task, identity, values, photo), /uncertain commit/);
  const record = await h.fresh().read(identity);
  assert.equal(record.kind, "found");
  assert.equal(record.evidenceMissing, false);
  assert.equal(h.images.has(record.slot.evidence.fileName), true);
});

test("discard removes slot before photo; failed discard keeps both", async () => {
  const h = harness();
  const saved = await h.store.saveDraft(task, identity, {}, photo);
  h.failure.removeSlot = true;
  await assert.rejects(h.store.discard(identity), /cannot discard/);
  assert.equal((await h.store.read(identity)).kind, "found");
  assert.equal(h.images.size, 1);
  h.failure.removeSlot = false; h.events.length = 0;
  await h.store.discard(identity);
  assert.deepEqual(h.events, ["discard", `delete:${saved.evidence.fileName}`]);
  assert.equal((await h.store.read(identity)).kind, "missing");
  assert.equal(h.images.size, 0);
});

test("unavailable reads block mutations instead of being treated as empty slots", async () => {
  const h = harness();
  await h.store.saveDraft(task, identity, values, photo);
  const previous = h.records.get(workerSlotKey(identity));
  h.failure.read = true;
  assert.equal((await h.store.read(identity)).kind, "unavailable");
  await assert.rejects(h.store.saveDraft(task, identity, {}, null), /read unavailable/);
  await assert.rejects(h.store.queue(task, identity, values, null), /read unavailable/);
  await assert.rejects(h.store.discard(identity), /read unavailable/);
  assert.equal(h.records.get(workerSlotKey(identity)), previous);
  h.failure.read = false;
  assert.equal((await h.store.read(identity)).kind, "found");
});

test("required evidence blocks queue; a missing saved image can be reattached without losing draft inputs", async () => {
  const h = harness();
  const id = workerIdentity(requiredTask);
  const raw = { "entrance-clear": false };
  await assert.rejects(h.store.queue(requiredTask, id, raw, null), /Photo evidence/);
  assert.equal((await h.store.read(id)).kind, "missing");
  const saved = await h.store.saveDraft(requiredTask, id, raw, photo);
  h.images.clear();
  const read = await h.fresh().read(id);
  assert.equal(read.kind, "found");
  assert.equal(read.evidenceMissing, true);
  assert.equal(read.evidenceUri, null);
  const selection = { kind: "saved", ...saved.evidence };
  assert.equal(await h.store.evidenceAvailable(selection), false);
  await assert.rejects(h.store.queue(requiredTask, id, raw, selection), /missing/);
  assert.deepEqual((await h.store.read(id)).slot.values, raw);
  assert.equal((await h.store.queue(requiredTask, id, raw, photo)).phase, "pending-demo");
});

test("pending/confirmed missing attachments stay read-only and retry never falsely confirms pending", async () => {
  const h = harness();
  await h.store.queue(task, identity, values, photo);
  const pending = h.records.get(workerSlotKey(identity));
  h.images.clear();
  await assert.rejects(h.store.retry(identity), /remains pending/);
  assert.equal(h.records.get(workerSlotKey(identity)), pending);
  assert.equal((await h.store.read(identity)).evidenceMissing, true);
  const fileName = JSON.parse(pending).evidence.fileName;
  h.images.add(fileName);
  const confirmed = await h.store.retry(identity);
  h.images.clear();
  assert.deepEqual(await h.store.retry(identity), confirmed);
  assert.equal((await h.store.read(identity)).evidenceMissing, true);
});

test("saved evidence cannot be borrowed from another slot and temporary files are checked at Review", async () => {
  const h = harness();
  const saved = await h.store.saveDraft(task, identity, values, photo);
  await assert.rejects(h.store.saveDraft(requiredTask, workerIdentity(requiredTask), {}, { kind: "saved", ...saved.evidence }), /does not belong/);
  assert.equal(await h.store.evidenceAvailable(photo), true);
  h.failure.temporaryMissing = true;
  assert.equal(await h.store.evidenceAvailable(photo), false);
  assert.equal(await h.store.evidenceAvailable(null), false);
});

test("failed queue and retry writes preserve the previous phase and same retry payload", async () => {
  const h = harness();
  await h.store.saveDraft(task, identity, values, photo);
  const draft = h.records.get(workerSlotKey(identity));
  h.failure.write = true;
  await assert.rejects(h.store.queue(task, identity, values, photo), /disk full/);
  assert.equal(h.records.get(workerSlotKey(identity)), draft);
  h.failure.write = false;
  const pending = await h.store.queue(task, identity, values, { kind: "saved", ...JSON.parse(draft).evidence });
  h.failure.write = true;
  await assert.rejects(h.store.retry(identity), /disk full/);
  assert.equal((await h.store.read(identity)).slot.phase, "pending-demo");
  h.failure.write = false;
  assert.deepEqual((await h.store.retry(identity)).payload, pending.payload);
});

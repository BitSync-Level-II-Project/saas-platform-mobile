import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoAttemptTransport,
  createWorkerSubmitSession,
  snapshotAttempt,
} from "../src/features/worker/worker-submit-session.ts";

const attempt = {
  clientAttemptId: "11111111-1111-4111-8111-111111111111",
  taskId: "equipment-check",
  templateVersionId: "22222222-2222-4222-8222-222222222222",
  answers: [
    { fieldId: "barcode", value: "001234" },
    { fieldId: "count", value: 0 },
    { fieldId: "damaged", value: false },
  ],
};

test("attempt snapshots keep typed values and do not follow later draft edits", () => {
  const draft = [{ fieldId: "barcode", value: "001234" }];
  const saved = snapshotAttempt({ ...attempt, answers: draft });
  draft[0].value = "changed";
  assert.deepEqual(saved.answers, [{ fieldId: "barcode", value: "001234" }]);
  assert.deepEqual(snapshotAttempt(attempt).answers, attempt.answers);
  assert.ok(Object.isFrozen(saved));
  assert.ok(Object.isFrozen(saved.answers));
  assert.ok(Object.isFrozen(saved.answers[0]));
});

test("lost response retries with the same ID and payload, then stops", async () => {
  const demo = createDemoAttemptTransport();
  const calls = [];
  const states = [];
  let prepares = 0;

  const session = createWorkerSubmitSession((payload) => {
    calls.push(payload);
    return demo(payload);
  });
  const prepare = () => {
    prepares += 1;
    return attempt;
  };

  await session.submit(prepare, (state) => states.push(state.phase));
  await session.submit(prepare, (state) => states.push(state.phase));
  await session.submit(prepare, (state) => states.push(state.phase));

  assert.deepEqual(states, ["sending", "retry", "sending", "confirmed"]);
  assert.equal(calls.length, 2);
  assert.equal(prepares, 1);
  assert.equal(calls[0], calls[1]);
  assert.deepEqual(calls[1], attempt);
});

test("double tap does not send a second request while the first is pending", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const states = [];
  const session = createWorkerSubmitSession(async (payload) => {
    calls += 1;
    await gate;
    return { clientAttemptId: payload.clientAttemptId, demo: true };
  });

  const first = session.submit(() => attempt, (state) => states.push(state.phase));
  await session.submit(() => attempt, (state) => states.push(state.phase));
  release();
  await first;

  assert.equal(calls, 1);
  assert.deepEqual(states, ["sending", "confirmed"]);
});

test("demo transport rejects changed answers under a recorded attempt ID", async () => {
  const demo = createDemoAttemptTransport();
  await assert.rejects(demo(attempt), /lost response/);
  await assert.rejects(demo({ ...attempt, answers: [] }), /payload conflict/);
  assert.equal((await demo(attempt)).clientAttemptId, attempt.clientAttemptId);
});

test("preparation failure stays editable and allows a fresh attempt", async () => {
  const states = [];
  let calls = 0;
  const session = createWorkerSubmitSession(async (payload) => {
    calls += 1;
    return { clientAttemptId: payload.clientAttemptId, demo: true };
  });

  await session.submit(() => { throw new Error("UUID unavailable"); }, (state) => states.push(state));
  assert.equal(calls, 0);
  assert.deepEqual(states, [{
    phase: "idle",
    message: "Could not prepare the demo attempt. Try again.",
  }]);

  await session.submit(() => attempt, (state) => states.push(state));
  assert.equal(calls, 1);
  assert.deepEqual(states.slice(1), [{ phase: "sending" }, { phase: "confirmed" }]);
});

test("unexpected receipts keep the original attempt available for retry", async () => {
  const receipts = [
    { clientAttemptId: "different-attempt", demo: true },
    { clientAttemptId: attempt.clientAttemptId, demo: false },
    { clientAttemptId: attempt.clientAttemptId, demo: true },
  ];
  const calls = [];
  const states = [];
  let prepares = 0;
  const session = createWorkerSubmitSession(async (payload) => {
    calls.push(payload);
    return receipts.shift();
  });

  for (let i = 0; i < 3; i += 1) {
    await session.submit(() => {
      prepares += 1;
      return attempt;
    }, (state) => states.push(state.phase));
  }

  assert.deepEqual(states, ["sending", "retry", "sending", "retry", "sending", "confirmed"]);
  assert.equal(prepares, 1);
  assert.ok(calls.every((payload) => payload === calls[0]));
});

test("new screen sessions start fresh without sharing recorded attempts", async () => {
  for (let i = 0; i < 2; i += 1) {
    const states = [];
    const session = createWorkerSubmitSession(createDemoAttemptTransport());
    await session.submit(() => attempt, (state) => states.push(state.phase));
    assert.deepEqual(states, ["sending", "retry"]);
  }
});

test("an optional form with no answers can be retried and confirmed", async () => {
  const states = [];
  const session = createWorkerSubmitSession(createDemoAttemptTransport());
  await session.submit(() => ({ ...attempt, answers: [] }), (state) => states.push(state.phase));
  await session.submit(() => { throw new Error("Must reuse the snapshot"); }, (state) => states.push(state.phase));
  assert.deepEqual(states, ["sending", "retry", "sending", "confirmed"]);
});

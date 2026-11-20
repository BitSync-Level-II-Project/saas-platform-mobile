export type WorkerAnswer = {
  readonly fieldId: string;
  readonly value: string | number | boolean;
};

export type AttemptPayload = {
  readonly clientAttemptId: string;
  readonly taskId: string;
  readonly templateVersionId: string;
  readonly answers: readonly WorkerAnswer[];
};

export type DemoReceipt = {
  readonly clientAttemptId: string;
  readonly demo: true;
};

export type SubmitState =
  | { phase: "idle"; message?: string }
  | { phase: "sending" }
  | { phase: "retry" }
  | { phase: "confirmed" };

export function snapshotAttempt(input: AttemptPayload): AttemptPayload {
  return Object.freeze({
    clientAttemptId: input.clientAttemptId,
    taskId: input.taskId,
    templateVersionId: input.templateVersionId,
    answers: Object.freeze(
      input.answers.map((answer) => Object.freeze({ ...answer })),
    ),
  });
}

// Screen-scoped simulation only: record it once, then lose the first reply.
export function createDemoAttemptTransport() {
  const recorded = new Map<string, { body: string; receipt: DemoReceipt }>();

  return async (payload: AttemptPayload): Promise<DemoReceipt> => {
    const body = JSON.stringify(payload);
    const existing = recorded.get(payload.clientAttemptId);
    if (existing) {
      if (existing.body !== body) throw new Error("Demo payload conflict");
      return existing.receipt;
    }

    const receipt: DemoReceipt = {
      clientAttemptId: payload.clientAttemptId,
      demo: true,
    };
    recorded.set(payload.clientAttemptId, { body, receipt });
    throw new Error("Simulated lost response");
  };
}

export function createWorkerSubmitSession(
  send: (payload: AttemptPayload) => Promise<DemoReceipt>,
) {
  let phase: SubmitState["phase"] = "idle";
  let attempt: AttemptPayload | undefined;

  return {
    async submit(
      prepare: () => AttemptPayload,
      onChange: (state: SubmitState) => void,
    ) {
      // Synchronous guard: two taps can arrive before React re-renders.
      if (phase === "sending" || phase === "confirmed") return;

      if (!attempt) {
        try {
          attempt = snapshotAttempt(prepare());
        } catch {
          onChange({
            phase: "idle",
            message: "Could not prepare the demo attempt. Try again.",
          });
          return;
        }
      }

      phase = "sending";
      onChange({ phase });

      try {
        const receipt = await send(attempt);
        if (
          receipt.demo !== true ||
          receipt.clientAttemptId !== attempt.clientAttemptId
        ) {
          throw new Error("Unexpected demo receipt");
        }
        phase = "confirmed";
      } catch {
        phase = "retry";
      }

      onChange({ phase });
    },
  };
}

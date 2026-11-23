import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { WorkerTask } from "./demo-worker-task";
import { workerIdentity, workerSlotKey, type SlotRead } from "./worker-offline-model";
import { workerOfflineStore } from "./worker-offline-store";

export function useWorkerRecords(tasks: readonly WorkerTask[]) {
  const [records, setRecords] = useState<Record<string, SlotRead>>({});
  const focused = useRef(false);
  const generation = useRef(0);
  const load = useCallback(() => {
    const current = ++generation.current;
    setRecords({});
    void Promise.all(tasks.map(async (task) => {
      const identity = workerIdentity(task);
      return [workerSlotKey(identity), await workerOfflineStore.read(identity)] as const;
    })).then((entries) => { if (focused.current && current === generation.current) setRecords(Object.fromEntries(entries)); });
  }, [tasks]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    load();
    return () => { focused.current = false; generation.current += 1; };
  }, [load]));
  return { records, retryLoad: load };
}

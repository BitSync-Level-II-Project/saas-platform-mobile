export type WorkerField = {
  id: string;
  label: string;
  required: boolean;
  type: "short-text" | "number" | "yes-no";
};

const versionId = "11111111-1111-4111-8111-111111111111";

export const demoWorkerTask = {
  id: "demo-task-01",
  title: "Daily site inspection",
  status: "Assigned",
  templateVersionId: versionId,

  form: {
    versionId,
    name: "Site inspection form",

    fields: [
      {
        id: "temperature",
        label: "Temperature (°C)",
        required: true,
        type: "number",
      },
      {
        id: "area-safe",
        label: "Is the work area safe?",
        required: true,
        type: "yes-no",
      },
      {
        id: "notes",
        label: "Additional notes",
        required: false,
        type: "short-text",
      },
    ] satisfies WorkerField[],
  },
};

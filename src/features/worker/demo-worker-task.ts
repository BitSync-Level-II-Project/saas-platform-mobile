export type WorkerField = {
  id: string;
  label: string;
  required: boolean;
  type: "short-text" | "number" | "yes-no" | "barcode" | "dropdown";
  options?: string[];
};

export type WorkerTask = {
  id: string;
  code: string;
  title: string;
  status: "Assigned" | "In progress";
  warehouse: string;
  location: string;
  dueLabel: string;
  supervisorName: string;
  instructions: string;
  templateVersionId: string;
  form: {
    versionId: string;
    version: number;
    details: { name: string };
    fields: WorkerField[];
  };
};

const equipmentVersion = "11111111-1111-4111-8111-111111111111";
const loadingBayVersion = "22222222-2222-4222-8222-222222222222";

export const demoWorkerTasks: WorkerTask[] = [
  {
    id: "equipment-check",
    code: "TSK-1042",
    title: "Morning equipment check",
    status: "Assigned",
    warehouse: "Colombo",
    location: "Machine room",
    dueLabel: "Today, 11:00",
    supervisorName: "Malith Senanayake",
    instructions: "Read the equipment display and record the condition.",
    templateVersionId: equipmentVersion,
    form: {
      versionId: equipmentVersion,
      version: 3,
      details: { name: "Equipment inspection" },
      fields: [
        {
          id: "equipment-code",
          label: "Equipment code",
          type: "barcode",
          required: true,
        },
        {
          id: "condition",
          label: "Condition",
          type: "dropdown",
          required: true,
          options: ["Good", "Needs attention"],
        },
        {
          id: "temperature",
          label: "Temperature (°C)",
          type: "number",
          required: true,
        },
        { id: "note", label: "Note", type: "short-text", required: false },
      ],
    },
  },
  {
    id: "loading-bay",
    code: "TSK-1041",
    title: "Loading bay inspection",
    status: "In progress",
    warehouse: "Colombo",
    location: "Loading bay",
    dueLabel: "Today, 14:00",
    supervisorName: "Malith Senanayake",
    instructions: "Check that the loading bay entrance is clear.",
    templateVersionId: loadingBayVersion,
    form: {
      versionId: loadingBayVersion,
      version: 1,
      details: { name: "Loading bay checklist" },
      fields: [
        {
          id: "entrance-clear",
          label: "Is the entrance clear?",
          type: "yes-no",
          required: true,
        },
      ],
    },
  },
];

export function findDemoTask(id: string) {
  return demoWorkerTasks.find((task) => task.id === id);
}

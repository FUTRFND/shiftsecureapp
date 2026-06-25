import { z } from "zod";

export const sectionSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "Section title is required").max(80),
  placeholder: z.string().trim().max(300).default(""),
  required: z.boolean().default(false),
});

export const templateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().trim().max(300).default(""),
  specialty: z.string().trim().max(80).default(""),
  is_default: z.boolean().default(false),
  sections: z.array(sectionSchema).min(1, "Add at least one section").max(30),
});

export type Section = z.infer<typeof sectionSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;

export type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  specialty: string;
  sections: Section[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export const newSectionId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export const PRESETS: { label: string; template: TemplateInput }[] = [
  {
    label: "SBAR",
    template: {
      name: "SBAR Handoff",
      description: "Situation, Background, Assessment, Recommendation",
      specialty: "Emergency Medicine",
      is_default: false,
      sections: [
        {
          id: newSectionId(),
          title: "Situation",
          placeholder: "Patient name, age, chief complaint, current status",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Background",
          placeholder: "Relevant history, comorbidities, allergies, current meds",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Assessment",
          placeholder: "Vitals, exam findings, working diagnosis, severity",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Recommendation",
          placeholder: "Pending tasks, anticipated needs, disposition plan",
          required: true,
        },
      ],
    },
  },
  {
    label: "I-PASS",
    template: {
      name: "I-PASS Handoff",
      description: "Illness severity, Patient summary, Action list, Situation awareness, Synthesis",
      specialty: "Emergency Medicine",
      is_default: false,
      sections: [
        {
          id: newSectionId(),
          title: "Illness severity",
          placeholder: "Stable / watcher / unstable",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Patient summary",
          placeholder: "Brief summary, events of shift",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Action list",
          placeholder: "To-dos with owner and timing",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Situation awareness & contingencies",
          placeholder: "If/then planning for likely changes",
          required: true,
        },
        {
          id: newSectionId(),
          title: "Synthesis by receiver",
          placeholder: "Receiver read-back and questions",
          required: false,
        },
      ],
    },
  },
  {
    label: "Blank",
    template: {
      name: "New template",
      description: "",
      specialty: "",
      is_default: false,
      sections: [{ id: newSectionId(), title: "Section 1", placeholder: "", required: false }],
    },
  },
];

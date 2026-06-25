export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskRow = {
  id: string;
  creator_id: string;
  owner_id: string;
  title: string;
  description: string;
  patient_ref: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileLite = {
  id: string;
  full_name: string;
  department: string;
};

export const STATUS_META: Record<TaskStatus, { label: string; tone: string }> = {
  todo: { label: "To do", tone: "bg-muted text-foreground" },
  in_progress: { label: "In progress", tone: "bg-primary/15 text-primary" },
  done: { label: "Done", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground line-through" },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; tone: string }> = {
  low: { label: "Low", tone: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", tone: "bg-secondary text-secondary-foreground border-border" },
  high: { label: "High", tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  urgent: { label: "Urgent", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export function initials(name: string, fallback: string) {
  const source = name?.trim() || fallback;
  return source
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

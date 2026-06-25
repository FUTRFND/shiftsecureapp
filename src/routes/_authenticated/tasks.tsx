import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Calendar,
  CircleDot,
  Loader2,
  Plus,
  Radio,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import {
  COLUMNS,
  PRIORITY_META,
  STATUS_META,
  initials,
  type ProfileLite,
  type TaskRow,
  type TaskStatus,
} from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Shift Secure" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const profilesById = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const load = useCallback(async () => {
    const [tasksRes, profilesRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, department").order("full_name"),
    ]);
    if (tasksRes.error) toast.error(tasksRes.error.message);
    if (profilesRes.error) toast.error(profilesRes.error.message);
    setTasks((tasksRes.data ?? []) as TaskRow[]);
    setProfiles((profilesRes.data ?? []) as ProfileLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        setTasks((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as TaskRow;
            if (prev.some((t) => t.id === row.id)) return prev;
            return [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as TaskRow;
            return prev.map((t) => (t.id === row.id ? row : t));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as TaskRow;
            return prev.filter((t) => t.id !== row.id);
          }
          return prev;
        });
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleStatusChange = async (task: TaskRow, status: TaskStatus) => {
    const prev = task.status;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
    }
  };

  const handleDelete = async (task: TaskRow) => {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) toast.error(error.message);
    else toast.success("Task deleted");
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (t: TaskRow) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <Activity className="h-4 w-4" strokeWidth={2.5} />
            </div>
            Shift Secure
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Shift tasks</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              Real-time task ownership
            </h1>
            <p className="mt-1 text-muted-foreground max-w-xl">
              Assign every action item to a teammate. Updates sync live across the shift.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" /> Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" /> Offline
                </>
              )}
            </div>
            <Button variant="hero" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((col) => (
              <section key={col.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold flex items-center gap-2">
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                    {col.label}
                  </h2>
                  <Badge variant="secondary">{grouped[col.id].length}</Badge>
                </div>
                <div className="space-y-3 min-h-[60px]">
                  {grouped[col.id].length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1 py-6 text-center">
                      No tasks here
                    </p>
                  )}
                  {grouped[col.id].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      assignee={profilesById.get(task.owner_id)}
                      creator={profilesById.get(task.creator_id)}
                      currentUserId={user?.id ?? ""}
                      onStatusChange={(s) => handleStatusChange(task, s)}
                      onEdit={() => openEdit(task)}
                      onDelete={() => handleDelete(task)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {user && (
        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentUserId={user.id}
          profiles={profiles}
          editing={editing}
          onSaved={load}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  assignee,
  creator,
  currentUserId,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  assignee?: ProfileLite;
  creator?: ProfileLite;
  currentUserId: string;
  onStatusChange: (s: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const priority = PRIORITY_META[task.priority];
  const isMine = task.owner_id === currentUserId;
  const canDelete = task.creator_id === currentUserId;
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && task.status !== "done" && due.getTime() < Date.now();

  return (
    <article className="group rounded-xl border border-border/60 bg-background p-3 shadow-card hover:shadow-elegant transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onEdit} className="text-left flex-1 min-w-0">
          <h3 className="font-medium leading-snug line-clamp-2">{task.title}</h3>
          {task.patient_ref && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.patient_ref}</p>
          )}
        </button>
        <Badge variant="outline" className={`shrink-0 ${priority.tone}`}>
          {priority.label}
        </Badge>
      </div>

      {task.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7">
            <AvatarFallback
              className={isMine ? "bg-primary text-primary-foreground text-xs" : "text-xs"}
            >
              {initials(assignee?.full_name ?? "", "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">
              {assignee?.full_name || "Unassigned"}{" "}
              {isMine && <span className="text-primary">· you</span>}
            </p>
            {creator && creator.id !== task.owner_id && (
              <p className="text-[10px] text-muted-foreground truncate">by {creator.full_name}</p>
            )}
          </div>
        </div>
        {due && (
          <div
            className={`flex items-center gap-1 text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
          >
            <Calendar className="h-3 w-3" />
            {due.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Select value={task.status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">{STATUS_META.todo.label}</SelectItem>
            <SelectItem value="in_progress">{STATUS_META.in_progress.label}</SelectItem>
            <SelectItem value="done">{STATUS_META.done.label}</SelectItem>
            <SelectItem value="cancelled">{STATUS_META.cancelled.label}</SelectItem>
          </SelectContent>
        </Select>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDelete}
            aria-label="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
    </article>
  );
}

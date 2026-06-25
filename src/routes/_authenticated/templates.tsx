import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ClipboardList, Loader2, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TemplateEditorDialog } from "@/components/templates/TemplateEditorDialog";
import { PRESETS, type TemplateInput, type TemplateRow } from "@/lib/templates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Handoff Templates — ShiftSecure" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [initial, setInitial] = useState<TemplateInput | null>(null);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("handoff_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setTemplates((data ?? []) as TemplateRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = (preset?: TemplateInput) => {
    setEditing(null);
    setInitial(preset ?? null);
    setEditorOpen(true);
  };

  const openEdit = (t: TemplateRow) => {
    setEditing(t);
    setInitial({
      name: t.name,
      description: t.description,
      specialty: t.specialty,
      is_default: t.is_default,
      sections: t.sections ?? [],
    });
    setEditorOpen(true);
  };

  const handleSave = async (input: TemplateInput): Promise<void> => {
    if (!user) return;
    if (input.is_default) {
      await supabase.from("handoff_templates").update({ is_default: false }).eq("user_id", user.id);
    }
    if (editing) {
      const { error } = await supabase
        .from("handoff_templates")
        .update({ ...input })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Template updated");
    } else {
      const { error } = await supabase
        .from("handoff_templates")
        .insert({ ...input, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Template created");
    }
    setEditorOpen(false);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("handoff_templates").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template deleted");
    setDeleting(null);
    await load();
  };




  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <Activity className="h-4 w-4" strokeWidth={2.5} />
            </div>
            ShiftSecure
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Templates</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Handoff templates</h1>
            <p className="mt-1 text-muted-foreground max-w-xl">
              Structured templates ensure nothing critical is missed during shift change.
            </p>
          </div>
          <Button variant="hero" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState onUsePreset={openCreate} onBlank={() => openCreate()} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id} className="shadow-card hover:shadow-elegant transition-shadow flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    {t.is_default && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-current" /> Default
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-3 line-clamp-1">{t.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {t.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {t.specialty && <Badge variant="outline">{t.specialty}</Badge>}
                    <Badge variant="outline">{t.sections?.length ?? 0} sections</Badge>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} aria-label="Delete template">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={initial}
        editingName={editing?.name}
        onSubmit={handleSave}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onUsePreset, onBlank }: { onUsePreset: (p: TemplateInput) => void; onBlank: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <ClipboardList className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">No templates yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start from a clinical preset or build your own from scratch.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {PRESETS.filter((p) => p.label !== "Blank").map((p) => (
          <Button key={p.label} variant="outline" onClick={() => onUsePreset(p.template)}>
            Start from {p.label}
          </Button>
        ))}
        <Button variant="hero" onClick={onBlank}>
          <Plus className="h-4 w-4" /> Blank template
        </Button>
      </div>
    </div>
  );
}

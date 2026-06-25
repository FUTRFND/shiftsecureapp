import { useEffect, useState } from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { templateSchema, newSectionId, type Section, type TemplateInput, PRESETS } from "@/lib/templates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TemplateInput | null;
  editingName?: string;
  onSubmit: (data: TemplateInput) => Promise<void>;
};

const emptyTemplate = (): TemplateInput => ({
  name: "",
  description: "",
  specialty: "",
  is_default: false,
  sections: [{ id: newSectionId(), title: "", placeholder: "", required: false }],
});

export function TemplateEditorDialog({ open, onOpenChange, initial, editingName, onSubmit }: Props) {
  const [form, setForm] = useState<TemplateInput>(emptyTemplate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? emptyTemplate());
      setErrors({});
    }
  }, [open, initial]);

  const isEditing = !!editingName;

  const updateField = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateSection = (id: string, patch: Partial<Section>) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addSection = () =>
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { id: newSectionId(), title: "", placeholder: "", required: false }],
    }));

  const removeSection = (id: string) =>
    setForm((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== id) }));

  const move = (idx: number, dir: -1 | 1) =>
    setForm((f) => {
      const next = [...f.sections];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, sections: next };
    });

  const applyPreset = (label: string) => {
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) setForm({ ...preset.template, sections: preset.template.sections.map((s) => ({ ...s, id: newSectionId() })) });
  };

  const handleSubmit = async () => {
    const result = templateSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(result.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{isEditing ? `Edit "${editingName}"` : "New handoff template"}</DialogTitle>
          <DialogDescription>
            Build a structured template so every shift change captures the same critical fields.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6 py-4">
          <div className="space-y-5">
            {!isEditing && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Start from a preset</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => applyPreset(p.label)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Template name</Label>
                <Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. ED Resus Handoff" />
                {errors["name"] && <p className="text-sm text-destructive">{errors["name"]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Input id="specialty" value={form.specialty} onChange={(e) => updateField("specialty", e.target.value)} placeholder="Emergency Medicine" />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="default">Default template</Label>
                <div className="flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3">
                  <Switch id="default" checked={form.is_default} onCheckedChange={(v) => updateField("is_default", v)} />
                  <span className="text-sm text-muted-foreground">Use for new handoffs</span>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={2} value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="When and why to use this template" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Sections</Label>
                <span className="text-xs text-muted-foreground">{form.sections.length} item{form.sections.length === 1 ? "" : "s"}</span>
              </div>
              {errors["sections"] && <p className="text-sm text-destructive mb-2">{errors["sections"]}</p>}
              <div className="space-y-3">
                {form.sections.map((section, idx) => (
                  <div key={section.id} className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col text-muted-foreground pt-2">
                        <button type="button" onClick={() => move(idx, -1)} className="hover:text-foreground text-xs leading-none" aria-label="Move up">▲</button>
                        <GripVertical className="h-4 w-4 my-0.5 opacity-50" />
                        <button type="button" onClick={() => move(idx, 1)} className="hover:text-foreground text-xs leading-none" aria-label="Move down">▼</button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          placeholder={`Section ${idx + 1} title`}
                        />
                        {errors[`sections.${idx}.title`] && (
                          <p className="text-sm text-destructive">{errors[`sections.${idx}.title`]}</p>
                        )}
                        <Textarea
                          rows={2}
                          value={section.placeholder}
                          onChange={(e) => updateSection(section.id, { placeholder: e.target.value })}
                          placeholder="Prompt or example of what to capture in this section"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Switch
                              checked={section.required}
                              onCheckedChange={(v) => updateSection(section.id, { required: v })}
                            />
                            Required
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSection(section.id)}
                            disabled={form.sections.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" /> Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addSection}>
                <Plus className="h-4 w-4" /> Add section
              </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border/60">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="hero" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

-- Handoff templates: each template has metadata + ordered sections (jsonb)
CREATE TABLE public.handoff_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handoff_templates TO authenticated;
GRANT ALL ON public.handoff_templates TO service_role;

ALTER TABLE public.handoff_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON public.handoff_templates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.handoff_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.handoff_templates FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.handoff_templates FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER handoff_templates_touch_updated_at
  BEFORE UPDATE ON public.handoff_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_handoff_templates_user ON public.handoff_templates(user_id, updated_at DESC);
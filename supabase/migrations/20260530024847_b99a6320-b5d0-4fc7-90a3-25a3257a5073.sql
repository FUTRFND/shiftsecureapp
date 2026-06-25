CREATE TABLE public.handoff_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled handoff',
  context TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  patient TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  assessment TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handoff_drafts TO authenticated;
GRANT ALL ON public.handoff_drafts TO service_role;

ALTER TABLE public.handoff_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own drafts" ON public.handoff_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own drafts" ON public.handoff_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own drafts" ON public.handoff_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own drafts" ON public.handoff_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER handoff_drafts_touch_updated_at
  BEFORE UPDATE ON public.handoff_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_handoff_drafts_user_updated ON public.handoff_drafts (user_id, updated_at DESC);
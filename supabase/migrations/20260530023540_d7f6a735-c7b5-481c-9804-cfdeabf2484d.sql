
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE public.patient_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  patient_ref text NOT NULL,
  summary text NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'critical',
  status public.alert_status NOT NULL DEFAULT 'active',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_alerts TO authenticated;
GRANT ALL ON public.patient_alerts TO service_role;

ALTER TABLE public.patient_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view alerts"
  ON public.patient_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create alerts"
  ON public.patient_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can acknowledge/resolve alerts"
  ON public.patient_alerts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Creator can delete alerts"
  ON public.patient_alerts FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER patient_alerts_touch_updated_at
  BEFORE UPDATE ON public.patient_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_alerts;
ALTER TABLE public.patient_alerts REPLICA IDENTITY FULL;

CREATE INDEX idx_patient_alerts_status_created ON public.patient_alerts(status, created_at DESC);

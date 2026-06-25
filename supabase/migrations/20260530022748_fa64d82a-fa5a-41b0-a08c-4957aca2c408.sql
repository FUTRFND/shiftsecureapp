-- Enums
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  patient_ref text NOT NULL DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks they own or created"
  ON public.tasks FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = creator_id);

CREATE POLICY "Users can create tasks as themselves"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Owner or creator can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = creator_id);

CREATE POLICY "Creator can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

CREATE TRIGGER tasks_touch_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_tasks_owner ON public.tasks(owner_id, status, due_at);
CREATE INDEX idx_tasks_creator ON public.tasks(creator_id);

-- Realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Allow authenticated users to read all profiles (for teammate lookup/assignment)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
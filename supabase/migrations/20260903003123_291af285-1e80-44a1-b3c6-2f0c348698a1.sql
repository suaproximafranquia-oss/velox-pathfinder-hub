ALTER TABLE public.workspace_e0_actions
  ADD COLUMN IF NOT EXISTS entry_at timestamptz,
  ADD COLUMN IF NOT EXISTS entered_entry_stage_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivation boolean NOT NULL DEFAULT false;
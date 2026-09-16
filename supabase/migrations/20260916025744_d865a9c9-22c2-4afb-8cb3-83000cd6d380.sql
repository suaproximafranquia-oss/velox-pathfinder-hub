ALTER TABLE public.environment_presentations
ADD COLUMN IF NOT EXISTS mux_playback_id text;

ALTER TABLE public.environment_presentations_history
ADD COLUMN IF NOT EXISTS mux_playback_id text;

COMMENT ON COLUMN public.environment_presentations.mux_playback_id IS 'Playback ID do asset Mux usado pela Apresentação Digital pública.';
COMMENT ON COLUMN public.environment_presentations_history.mux_playback_id IS 'Playback ID Mux arquivado com a versão anterior da apresentação.';
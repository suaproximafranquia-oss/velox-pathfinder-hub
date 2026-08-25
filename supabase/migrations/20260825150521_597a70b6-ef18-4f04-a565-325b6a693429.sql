CREATE TABLE public.remarketing_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  contact_name text,
  campaign_id uuid REFERENCES public.remarketing_campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  status text NOT NULL DEFAULT 'aguardando',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NOT NULL DEFAULT '',
  last_direction text NOT NULL DEFAULT 'saida',
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remarketing_conversations TO authenticated;
GRANT ALL ON public.remarketing_conversations TO service_role;
ALTER TABLE public.remarketing_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace opera conversas de remarketing"
  ON public.remarketing_conversations FOR ALL TO authenticated
  USING (public.is_portal_member()) WITH CHECK (public.is_portal_member());

CREATE TABLE public.remarketing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.remarketing_conversations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.remarketing_campaigns(id) ON DELETE SET NULL,
  direction text NOT NULL,
  kind text NOT NULL DEFAULT 'texto',
  body text NOT NULL DEFAULT '',
  template_name text,
  author_name text,
  delivered boolean NOT NULL DEFAULT true,
  error text,
  simulated boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX remarketing_messages_conversation_idx
  ON public.remarketing_messages (conversation_id, occurred_at);
CREATE INDEX remarketing_conversations_activity_idx
  ON public.remarketing_conversations (last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remarketing_messages TO authenticated;
GRANT ALL ON public.remarketing_messages TO service_role;
ALTER TABLE public.remarketing_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace opera mensagens de remarketing"
  ON public.remarketing_messages FOR ALL TO authenticated
  USING (public.is_portal_member()) WITH CHECK (public.is_portal_member());

CREATE TRIGGER remarketing_conversations_updated
  BEFORE UPDATE ON public.remarketing_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
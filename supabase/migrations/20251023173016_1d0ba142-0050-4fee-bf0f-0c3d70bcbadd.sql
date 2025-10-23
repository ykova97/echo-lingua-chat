-- === Indexes for hot paths ===

-- Messages by chat + time
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at_desc
  ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at_asc
  ON public.messages (chat_id, created_at ASC);

-- Translations lookup for current user
CREATE INDEX IF NOT EXISTS idx_message_translations_user_msg
  ON public.message_translations (user_id, message_id);

-- Participants by chat and user
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_user
  ON public.chat_participants (chat_id, user_id);

-- Reactions / read receipts by message
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message
  ON public.message_read_receipts (message_id);

-- === Simple translation cache ===
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id bigserial PRIMARY KEY,
  hash text UNIQUE NOT NULL,              -- sha256(src|dst|text)
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  text text NOT NULL,
  translated_text text NOT NULL,
  last_used timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MINIMAL RLS (read by service role only; not exposed to clients)
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cache_no_access" ON public.translation_cache;
CREATE POLICY "cache_no_access" ON public.translation_cache
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
-- Allow reading messages from ephemeral chats (guest chats)
-- These are temporary and expire, so this is acceptable
CREATE POLICY "Allow reading messages from ephemeral chats"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
    AND chats.is_ephemeral = true
  )
);
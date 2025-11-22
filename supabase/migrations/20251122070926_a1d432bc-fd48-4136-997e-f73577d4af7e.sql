-- Add missing columns to chats table (conversations)
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS guest_session_id uuid REFERENCES public.guest_sessions(id),
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Add missing columns to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_type text CHECK (sender_type IN ('user', 'guest'));

-- Update existing messages to set sender_type based on whether sender_id exists in profiles or guest_sessions
UPDATE public.messages m
SET sender_type = CASE 
  WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.sender_id) THEN 'user'
  WHEN EXISTS (SELECT 1 FROM public.guest_sessions g WHERE g.id = m.sender_id) THEN 'guest'
  ELSE 'user'
END
WHERE sender_type IS NULL;

-- Make sender_type NOT NULL after backfilling
ALTER TABLE public.messages ALTER COLUMN sender_type SET NOT NULL;

-- Create index for guest_session_id on chats
CREATE INDEX IF NOT EXISTS idx_chats_guest_session_id ON public.chats(guest_session_id);

-- Create index for sender_type on messages for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON public.messages(sender_type);

-- Add comment to clarify that guest_invites serves as share_tokens
COMMENT ON TABLE public.guest_invites IS 'Serves as share_tokens for QR invite links. token field is the shareable token, inviter_id references the user who created the invite';

-- Add comment to clarify that chats serves as conversations
COMMENT ON TABLE public.chats IS 'Serves as conversations table. created_by is the owner_user_id, guest_session_id links to guest sessions, delete_after serves as expires_at';
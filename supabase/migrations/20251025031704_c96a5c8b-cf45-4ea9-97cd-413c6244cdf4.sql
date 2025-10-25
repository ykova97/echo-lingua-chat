-- Remove the foreign key constraint that's blocking guest users
ALTER TABLE public.chat_participants 
DROP CONSTRAINT IF EXISTS chat_participants_user_id_fkey;

-- Add a comment to document that user_id can reference either auth.users OR guest_sessions
COMMENT ON COLUMN public.chat_participants.user_id IS 'References either auth.users.id or guest_sessions.id';

-- Update RLS policies to allow guest chat access
-- The existing policies already handle this via JWT claims with chat_id
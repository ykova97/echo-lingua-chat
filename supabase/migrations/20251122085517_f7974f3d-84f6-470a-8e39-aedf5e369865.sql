-- Remove the foreign key constraint on messages.sender_id
-- since guests are not in the profiles table
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- The sender_id will now be either a profile ID or a guest_session ID
-- depending on sender_type ('user' or 'guest')
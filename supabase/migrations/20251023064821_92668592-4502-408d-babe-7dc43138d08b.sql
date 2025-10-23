-- Drop the old foreign key that points to auth.users
ALTER TABLE public.chat_participants 
DROP CONSTRAINT IF EXISTS chat_participants_user_id_fkey;

-- Create new foreign key pointing to profiles instead
ALTER TABLE public.chat_participants
ADD CONSTRAINT chat_participants_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
-- Drop the old foreign key that points to auth.users
ALTER TABLE public.messages 
DROP CONSTRAINT messages_sender_id_fkey;

-- Create new foreign key pointing to profiles instead
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;
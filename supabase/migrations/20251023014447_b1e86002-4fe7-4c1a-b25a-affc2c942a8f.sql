-- Create a security definer function to check if user is in a chat
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE user_id = _user_id
      AND chat_id = _chat_id
  )
$$;

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view participants in their chats" ON chat_participants;

-- Create a non-recursive policy using the security definer function
CREATE POLICY "Users can view participants in their chats"
ON chat_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  public.is_chat_participant(auth.uid(), chat_id)
);

-- Also fix the "Chat creators can add participants" policy to be simpler
DROP POLICY IF EXISTS "Chat creators can add participants" ON chat_participants;

CREATE POLICY "Chat creators can add participants"
ON chat_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM chats
    WHERE chats.id = chat_participants.chat_id
      AND chats.created_by = auth.uid()
  )
);
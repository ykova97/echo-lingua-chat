-- Fix the chats SELECT policy to allow creators to see chats they created
-- even before participants are added

DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;

CREATE POLICY "Users can view chats they participate in"
ON chats
FOR SELECT
USING (
  -- User is a participant OR user is the creator
  EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
  )
  OR
  created_by = auth.uid()
);
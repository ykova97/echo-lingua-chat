-- Fix infinite recursion in chat_participants RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their chats" ON chat_participants;

-- Create a corrected policy that doesn't self-reference
CREATE POLICY "Users can view participants in their chats"
ON chat_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  chat_id IN (
    SELECT chat_id 
    FROM chat_participants 
    WHERE user_id = auth.uid()
  )
);
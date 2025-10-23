-- Allow users to delete chats they created
CREATE POLICY "Users can delete chats they created" 
ON public.chats 
FOR DELETE 
USING (auth.uid() = created_by);

-- Allow chat creators to remove participants
CREATE POLICY "Chat creators can remove participants" 
ON public.chat_participants 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = chat_participants.chat_id 
    AND chats.created_by = auth.uid()
  )
);

-- Allow users to delete messages in chats they created
CREATE POLICY "Users can delete messages in their chats" 
ON public.messages 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND chats.created_by = auth.uid()
  )
);

-- Allow users to delete reactions in their chats
CREATE POLICY "Users can delete reactions in their chats" 
ON public.message_reactions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.messages m
    JOIN public.chats c ON c.id = m.chat_id
    WHERE m.id = message_reactions.message_id 
    AND c.created_by = auth.uid()
  )
);

-- Allow users to delete read receipts in their chats
CREATE POLICY "Users can delete read receipts in their chats" 
ON public.message_read_receipts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.messages m
    JOIN public.chats c ON c.id = m.chat_id
    WHERE m.id = message_read_receipts.message_id 
    AND c.created_by = auth.uid()
  )
);

-- Allow users to delete translations in their chats
CREATE POLICY "Users can delete translations in their chats" 
ON public.message_translations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.messages m
    JOIN public.chats c ON c.id = m.chat_id
    WHERE m.id = message_translations.message_id 
    AND c.created_by = auth.uid()
  )
);
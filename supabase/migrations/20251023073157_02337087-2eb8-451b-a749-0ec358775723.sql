-- Create chat attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true);

-- RLS policies for chat attachments
CREATE POLICY "Users can upload attachments to their chats"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view attachments in their chats"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add attachment support to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;
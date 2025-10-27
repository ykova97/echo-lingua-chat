-- Create chat-uploads storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for chat-uploads bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-uploads' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to view files in chats they participate in
CREATE POLICY "Users can view chat attachments in their chats"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-uploads' AND
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_id::text = (storage.foldername(name))[1]
    AND user_id = auth.uid()
  )
);

-- Allow public access since bucket is public
CREATE POLICY "Public can view chat attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-uploads');
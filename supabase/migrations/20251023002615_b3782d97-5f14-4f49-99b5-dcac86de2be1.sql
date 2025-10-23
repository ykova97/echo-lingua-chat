-- Add handle system to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS handle text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle);

-- Add status and privacy fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_read_receipts boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online_status boolean DEFAULT true;

-- Create message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(message_id, user_id, reaction)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add reactions to messages in their chats"
  ON message_reactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = message_reactions.message_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view reactions in their chats"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = message_reactions.message_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own reactions"
  ON message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Add reply, edit, and read receipt fields to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Create message read receipts table
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamp with time zone DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can mark messages as read in their chats"
  ON message_read_receipts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = message_read_receipts.message_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view read receipts in their chats"
  ON message_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_participants cp ON cp.chat_id = m.chat_id
      WHERE m.id = message_read_receipts.message_id 
      AND cp.user_id = auth.uid()
    )
  );

-- Create blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_at timestamp with time zone DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can block other users"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can view their blocked list"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock users"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Create muted chats table
CREATE TABLE IF NOT EXISTS muted_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_at timestamp with time zone DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE muted_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can mute their chats"
  ON muted_chats FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_id = muted_chats.chat_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their muted chats"
  ON muted_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unmute chats"
  ON muted_chats FOR DELETE
  USING (auth.uid() = user_id);

-- Add admin role to chat participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE message_read_receipts;
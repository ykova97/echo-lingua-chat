-- JWT claim-based policies for guest access
-- These work alongside existing auth.uid() policies

-- messages: allow guests to view/insert in their scoped chat
drop policy if exists messages_chat_scope on public.messages;
create policy messages_chat_scope on public.messages
  for select using (
    chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
  );

drop policy if exists messages_insert_chat_scope on public.messages;
create policy messages_insert_chat_scope on public.messages
  for insert with check (
    chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
  );

-- message_translations: allow guests to view translations in their scoped chat
drop policy if exists mt_chat_scope on public.message_translations;
create policy mt_chat_scope on public.message_translations
  for select using (
    exists (
      select 1 from public.messages m 
      where m.id = message_translations.message_id
        and m.chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
    )
  );

-- chats: allow guests to view their scoped chat
drop policy if exists chats_chat_scope on public.chats;
create policy chats_chat_scope on public.chats
  for select using (
    id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
  );

-- chat_participants: allow guests to view participants in their scoped chat
drop policy if exists chat_participants_guest_scope on public.chat_participants;
create policy chat_participants_guest_scope on public.chat_participants
  for select using (
    chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
  );

-- profiles: allow guests to view profiles of users in their chat
drop policy if exists profiles_guest_scope on public.profiles;
create policy profiles_guest_scope on public.profiles
  for select using (
    exists (
      select 1 from public.chat_participants cp
      where cp.user_id = profiles.id
        and cp.chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
    )
  );

-- message_reactions: allow guests to view/add reactions in their scoped chat
drop policy if exists reactions_guest_view on public.message_reactions;
create policy reactions_guest_view on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
    )
  );

drop policy if exists reactions_guest_insert on public.message_reactions;
create policy reactions_guest_insert on public.message_reactions
  for insert with check (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.chat_id::text = current_setting('request.jwt.claims', true)::jsonb->>'chat_id'
    )
  );
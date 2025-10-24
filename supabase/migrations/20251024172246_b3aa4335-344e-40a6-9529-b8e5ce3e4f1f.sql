-- One-time QR invite tokens issued by a real user
create table if not exists public.guest_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  max_uses int not null default 1,
  used_count int not null default 0
);

-- Ephemeral guest users (not in auth.users)
create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  preferred_language text not null,
  invite_id uuid not null references public.guest_invites(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- Mark chats as ephemeral
alter table public.chats
  add column if not exists is_ephemeral boolean not null default false;

-- Optional: soft-delete marker for cleanup flow
alter table public.chats
  add column if not exists delete_after timestamptz;

-- Helpful indexes
create index if not exists idx_guest_invites_token on public.guest_invites(token);
create index if not exists idx_guest_sessions_invite on public.guest_sessions(invite_id);
create index if not exists idx_chats_delete_after on public.chats(delete_after) where delete_after is not null;

-- Enable RLS
alter table public.guest_invites enable row level security;
alter table public.guest_sessions enable row level security;

-- RLS policies for guest_invites
create policy "Users can view their own invites"
  on public.guest_invites for select
  using (auth.uid() = inviter_id);

create policy "Users can create invites"
  on public.guest_invites for insert
  with check (auth.uid() = inviter_id);

create policy "Users can delete their own invites"
  on public.guest_invites for delete
  using (auth.uid() = inviter_id);

-- RLS policies for guest_sessions
create policy "Guest sessions readable by invite creator"
  on public.guest_sessions for select
  using (
    exists (
      select 1 from public.guest_invites gi
      where gi.id = guest_sessions.invite_id
      and gi.inviter_id = auth.uid()
    )
  );

create policy "System can insert guest sessions"
  on public.guest_sessions for insert
  with check (true);
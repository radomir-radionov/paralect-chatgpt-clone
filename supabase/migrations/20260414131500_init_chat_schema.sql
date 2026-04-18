/* Base DDL for the chat domain: user_profile, chat_room, chat_room_member, message. */

create extension if not exists "pgcrypto";

create table if not exists public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_room (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_public boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_room_member (
  chat_room_id uuid not null references public.chat_room(id) on delete cascade,
  member_id uuid not null references public.user_profile(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_room_id, member_id)
);

create index if not exists chat_room_member_member_id_idx
  on public.chat_room_member (member_id);

create table if not exists public.message (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  chat_room_id uuid not null references public.chat_room(id) on delete cascade,
  author_id uuid not null references public.user_profile(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists message_chat_room_id_created_at_idx
  on public.message (chat_room_id, created_at desc);

create index if not exists message_author_id_idx
  on public.message (author_id);

alter table public.user_profile enable row level security;
alter table public.chat_room enable row level security;
alter table public.chat_room_member enable row level security;
alter table public.message enable row level security;

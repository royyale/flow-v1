-- ============================================
-- FLOW — Supabase RAG Setup v2
-- Fixed to match your actual schema
-- Run in Supabase SQL Editor
-- ============================================

-- STEP 1: Enable pgvector
create extension if not exists vector;

-- ============================================
-- STEP 2: Fix the typo in chat_messages
-- created_art → created_at
-- (safe to run even if already fixed)
-- ============================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'chat_messages'
      and column_name  = 'created_art'
  ) then
    alter table public.chat_messages
      rename column created_art to created_at;
    raise notice 'Renamed created_art → created_at on chat_messages';
  else
    raise notice 'created_at already correct — skipping rename';
  end if;
end $$;

-- ============================================
-- STEP 3: Add session_id to existing chat_messages
-- (your table already exists, we just extend it)
-- ============================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'chat_messages'
      and column_name  = 'session_id'
  ) then
    alter table public.chat_messages
      add column session_id uuid;
    raise notice 'Added session_id to chat_messages';
  else
    raise notice 'session_id already exists — skipping';
  end if;
end $$;

-- ============================================
-- STEP 4: Chat Sessions table
-- (new table — safe if already exists)
-- ============================================
create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  consultant_id uuid references auth.users(id) on delete cascade not null,
  client_id     uuid references public.clients(id) on delete set null,
  title         text not null default 'New Chat',
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- Wire the FK now that the column + table both exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'chat_messages_session_id_fkey'
      and table_name      = 'chat_messages'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_session_id_fkey
      foreign key (session_id)
      references public.chat_sessions(id)
      on delete cascade;
    raise notice 'Added FK chat_messages.session_id → chat_sessions.id';
  end if;
end $$;

-- Auto-bump updated_at on session edits
create or replace function update_session_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_sessions_updated_at on chat_sessions;
create trigger chat_sessions_updated_at
  before update on chat_sessions
  for each row execute function update_session_updated_at();

-- ============================================
-- STEP 5: Flow Documents table
-- ============================================
create table if not exists flow_documents (
  id            uuid primary key default gen_random_uuid(),
  consultant_id uuid references auth.users(id) on delete cascade not null,
  client_id     uuid references public.clients(id) on delete cascade,
  session_id    uuid references public.chat_sessions(id) on delete set null,
  file_name     text not null,
  file_type     text not null,
  storage_path  text not null,
  content_text  text,
  embedded      boolean default false,
  created_at    timestamp with time zone default now()
);

-- ============================================
-- STEP 6: Flow Embeddings table (RAG memory)
-- ============================================
create table if not exists flow_embeddings (
  id            uuid primary key default gen_random_uuid(),
  consultant_id uuid references auth.users(id) on delete cascade not null,
  client_id     uuid references public.clients(id) on delete cascade,
  document_id   uuid references public.flow_documents(id) on delete cascade,
  session_id    uuid references public.chat_sessions(id) on delete set null,
  content       text not null,
  doc_type      text not null, -- 'conversation' | 'document' | 'task_note'
  embedding     vector(1536),
  created_at    timestamp with time zone default now()
);

-- ============================================
-- STEP 7: Similarity search function
-- ============================================
create or replace function match_flow_documents (
  query_embedding   vector(1536),
  filter_client_id  uuid,
  match_count       int default 5
)
returns table (content text, similarity float)
language sql stable
as $$
  select
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.flow_embeddings
  where client_id = filter_client_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================
-- STEP 8: Row Level Security
-- ============================================

-- chat_sessions
alter table public.chat_sessions enable row level security;

drop policy if exists "Consultants see own sessions" on public.chat_sessions;
create policy "Consultants see own sessions"
  on public.chat_sessions for all
  using (auth.uid() = consultant_id);

-- chat_messages — your table uses user_id, keep that for existing rows
-- new rows will also have session_id set
alter table public.chat_messages enable row level security;

drop policy if exists "Consultants see own messages" on public.chat_messages;
create policy "Consultants see own messages"
  on public.chat_messages for all
  using (auth.uid() = user_id);

-- flow_documents
alter table public.flow_documents enable row level security;

drop policy if exists "Consultants see own documents" on public.flow_documents;
create policy "Consultants see own documents"
  on public.flow_documents for all
  using (auth.uid() = consultant_id);

-- flow_embeddings
alter table public.flow_embeddings enable row level security;

drop policy if exists "Consultants see own embeddings" on public.flow_embeddings;
create policy "Consultants see own embeddings"
  on public.flow_embeddings for all
  using (auth.uid() = consultant_id);

-- ============================================
-- STEP 9: Indexes for performance
-- ============================================
create index if not exists idx_chat_sessions_consultant
  on public.chat_sessions(consultant_id);

create index if not exists idx_chat_messages_session
  on public.chat_messages(session_id);

create index if not exists idx_chat_messages_user
  on public.chat_messages(user_id);

create index if not exists idx_flow_embeddings_client
  on public.flow_embeddings(client_id);

-- Vector similarity index
create index if not exists idx_flow_embeddings_vector
  on public.flow_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================
-- STEP 10: Verify — run this to confirm setup
-- ============================================
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'chat_messages',
    'chat_sessions',
    'flow_documents',
    'flow_embeddings'
  )
order by table_name, ordinal_position;

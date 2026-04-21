-- Gmail integration + AI extraction pipeline

create table if not exists public.email_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gmail_access_token text not null,
  gmail_refresh_token text not null,
  connected_at timestamptz not null default now()
);

alter table public.email_integrations enable row level security;

drop policy if exists "Users manage own email integrations" on public.email_integrations;
create policy "Users manage own email integrations"
  on public.email_integrations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.watched_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists watched_clients_user_email_unique
  on public.watched_clients(user_id, lower(client_email));

alter table public.watched_clients enable row level security;

drop policy if exists "Users manage own watched clients" on public.watched_clients;
create policy "Users manage own watched clients"
  on public.watched_clients
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.processed_emails (
  email_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  processed_at timestamptz not null default now(),
  task_generated boolean not null default false,
  primary key (email_id, user_id)
);

alter table public.processed_emails enable row level security;

drop policy if exists "Users manage own processed emails" on public.processed_emails;
create policy "Users manage own processed emails"
  on public.processed_emails
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_task_review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_email_id text not null,
  sender_email text not null,
  sender_name text,
  task_title text not null,
  due_date timestamptz,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  client_name text,
  email_subject text,
  email_snippet text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists ai_task_review_queue_user_email_unique
  on public.ai_task_review_queue(user_id, source_email_id);

alter table public.ai_task_review_queue enable row level security;

drop policy if exists "Users manage own review queue" on public.ai_task_review_queue;
create policy "Users manage own review queue"
  on public.ai_task_review_queue
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

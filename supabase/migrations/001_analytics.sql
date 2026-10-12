-- sessions: one row per NFC tap / page load
create table sessions (
  id               uuid primary key default gen_random_uuid(),
  chip_id          text not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int,
  user_agent       text,
  referrer         text
);

-- events: one row per tracked action
-- event_name values: page_open, mode_selected, game_win, game_loss, review_click
create table events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id),
  chip_id      text not null,
  event_name   text not null,
  payload      jsonb default '{}',
  created_at   timestamptz not null default now()
);

-- Indexes for dashboard queries
create index events_session_id_idx  on events (session_id);
create index events_event_name_idx  on events (event_name);
create index events_chip_id_idx     on events (chip_id);
create index sessions_chip_id_idx   on sessions (chip_id);

-- Row-level security: game client uses the anon key, so only allow inserts/updates
alter table sessions enable row level security;
alter table events   enable row level security;

create policy "anon insert sessions" on sessions
  for insert to anon with check (true);

create policy "anon update own session" on sessions
  for update to anon using (true) with check (true);

create policy "anon insert events" on events
  for insert to anon with check (true);

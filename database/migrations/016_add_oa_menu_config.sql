-- Create table to store OA menu configuration
create table if not exists oa_menu_config (
  id uuid primary key default gen_random_uuid(),
  menu_json jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure a single row exists (optional, used by backend with fixed ID)
insert into oa_menu_config (id, menu_json)
values ('00000000-0000-0000-0000-000000000002', '{"button":[]}'::jsonb)
on conflict (id) do nothing;

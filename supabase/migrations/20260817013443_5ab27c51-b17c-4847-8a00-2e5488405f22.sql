create table if not exists public.relationship_content_groups (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.relationship_contents(id) on delete cascade,
  content_group text not null,
  created_at timestamptz not null default now(),
  unique (content_id, content_group)
);
grant all on public.relationship_content_groups to service_role;
alter table public.relationship_content_groups enable row level security;

insert into public.relationship_content_groups (content_id, content_group)
select id, content_group from public.relationship_contents where scope = 'library'
on conflict do nothing;

alter table public.relationship_contents add column if not exists body text;
alter table public.relationship_contents alter column url set default '';
create index if not exists relationship_content_groups_group_idx on public.relationship_content_groups (content_group);
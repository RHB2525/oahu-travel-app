-- Home Construction Estimator: tables and storage for saving work to a user's account.
-- Every row and file belongs to one user; row-level security keeps each user to their own data.

create table if not exists public.estimator_projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists estimator_projects_user_updated on public.estimator_projects (user_id, updated_at desc);

create table if not exists public.estimator_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.estimator_projects enable row level security;
alter table public.estimator_settings enable row level security;

create policy "Own projects: read" on public.estimator_projects for select to authenticated using (user_id = (select auth.uid()));
create policy "Own projects: insert" on public.estimator_projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own projects: update" on public.estimator_projects for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own projects: delete" on public.estimator_projects for delete to authenticated using (user_id = (select auth.uid()));

create policy "Own settings: read" on public.estimator_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "Own settings: insert" on public.estimator_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own settings: update" on public.estimator_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own settings: delete" on public.estimator_settings for delete to authenticated using (user_id = (select auth.uid()));

-- Plan set PDFs, stored as <user id>/<plan key>.pdf in a private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plans', 'plans', false, 104857600, array['application/pdf'])
on conflict (id) do nothing;

create policy "Own plans: read" on storage.objects for select to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own plans: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own plans: update" on storage.objects for update to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own plans: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = (select auth.uid())::text);

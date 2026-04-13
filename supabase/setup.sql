-- AgriIntel — Supabase setup (run in SQL Editor when creating a fresh project or fixing schema/RLS)
--
-- WHERE TO SEE DATA IN THE DASHBOARD (no SQL required for viewing):
--   • Images: Storage → bucket "crop-photos" → open object / preview.
--   • Rows + photo_url text: Table Editor → public.crop_grades → column photo_url links to that file.
--
-- This file mirrors the payload in server.js POST /api/save-grade and GET /api/grades.

-- ---------------------------------------------------------------------------
-- 1) Table: public.crop_grades
-- ---------------------------------------------------------------------------

create table if not exists public.crop_grades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  batch_id text,
  latitude double precision,
  longitude double precision,
  address text,
  city text,
  province text,
  region text,
  country text,

  photo_url text,
  crop_type text,
  grade text,
  confidence integer,
  explanation text,
  key_observations jsonb,
  suggested_price_range text,
  recommended_action text,

  grader_name text,
  location_barangay text,
  notes text,
  ai_graded boolean,
  override_reason text,

  color_score integer,
  size_score integer,
  defects text,
  texture text,

  nutrient_n integer,
  nutrient_p integer,
  nutrient_k integer
);

create index if not exists crop_grades_created_at_idx on public.crop_grades (created_at desc);
create index if not exists crop_grades_crop_type_idx on public.crop_grades (crop_type);

-- ---------------------------------------------------------------------------
-- 2) Row Level Security (app uses SUPABASE_ANON_KEY)
-- ---------------------------------------------------------------------------

alter table public.crop_grades enable row level security;

drop policy if exists "crop_grades_anon_select" on public.crop_grades;
create policy "crop_grades_anon_select"
  on public.crop_grades
  for select
  to anon
  using (true);

drop policy if exists "crop_grades_anon_insert" on public.crop_grades;
create policy "crop_grades_anon_insert"
  on public.crop_grades
  for insert
  to anon
  with check (true);

-- Optional: allow service role full access (default); tighten policies for production as needed.

-- ---------------------------------------------------------------------------
-- 3) Storage: bucket "crop-photos" + policies (matches server.js upload path)
-- ---------------------------------------------------------------------------
-- Create bucket if missing (public URL used by getPublicUrl in app).
insert into storage.buckets (id, name, public)
values ('crop-photos', 'crop-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "crop_photos_public_read" on storage.objects;
create policy "crop_photos_public_read"
  on storage.objects
  for select
  using (bucket_id = 'crop-photos');

drop policy if exists "crop_photos_anon_insert" on storage.objects;
create policy "crop_photos_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'crop-photos');

drop policy if exists "crop_photos_anon_update" on storage.objects;
create policy "crop_photos_anon_update"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'crop-photos')
  with check (bucket_id = 'crop-photos');

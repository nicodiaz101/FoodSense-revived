-- FoodSense inventory schema
-- Auth: Firebase Auth via Supabase third-party auth integration.
-- Firebase UIDs (text) are stored in user_id.
-- All access goes through the publishable key + Firebase JWT;
-- no service-role key is used by the app.

create table if not exists products (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  name       text        not null,
  category   text        not null,
  state      text        not null,
  expires_at date        not null,
  quantity   integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_user_id_idx on products (user_id);

create table if not exists product_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  type        text        not null check (type in ('consumed', 'wasted')),
  occurred_at timestamptz not null default now()
);

create index if not exists product_events_user_id_idx  on product_events (user_id);
create index if not exists product_events_occurred_idx on product_events (occurred_at);

-- Auto-update updated_at on products
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────

alter table products       enable row level security;
alter table product_events enable row level security;

-- Grant table-level access so RLS policies are evaluated.
-- Row-level restrictions are enforced by the policies below.
grant select, insert, update, delete on products       to anon, authenticated;
grant select, insert                  on product_events to anon, authenticated;

-- ── products ──────────────────────────────────────────────────

-- RESTRICTIVE: only accept JWTs issued by our Firebase project.
-- Tokens from any other project are rejected before permissive checks run.
create policy "products_firebase_issuer"
  on products as restrictive to anon, authenticated
  using (
    auth.jwt()->>'iss' = 'https://securetoken.google.com/foodsense-revive'
    and auth.jwt()->>'aud' = 'foodsense-revive'
  );

create policy "products_select"
  on products for select to anon, authenticated
  using ((auth.jwt()->>'sub') = user_id);

create policy "products_insert"
  on products for insert to anon, authenticated
  with check ((auth.jwt()->>'sub') = user_id);

create policy "products_update"
  on products for update to anon, authenticated
  using      ((auth.jwt()->>'sub') = user_id)
  with check ((auth.jwt()->>'sub') = user_id);

create policy "products_delete"
  on products for delete to anon, authenticated
  using ((auth.jwt()->>'sub') = user_id);

-- ── product_events ────────────────────────────────────────────

create policy "events_firebase_issuer"
  on product_events as restrictive to anon, authenticated
  using (
    auth.jwt()->>'iss' = 'https://securetoken.google.com/foodsense-revive'
    and auth.jwt()->>'aud' = 'foodsense-revive'
  );

create policy "events_select"
  on product_events for select to anon, authenticated
  using ((auth.jwt()->>'sub') = user_id);

create policy "events_insert"
  on product_events for insert to anon, authenticated
  with check ((auth.jwt()->>'sub') = user_id);

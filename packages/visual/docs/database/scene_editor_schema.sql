-- Scene editor database schema draft for future multiplayer housing.
-- This file is a planning artifact for Postgres/Supabase-style storage.

create table if not exists asset_catalog (
  id text primary key,
  name text not null,
  category text not null,
  kind text not null,
  texture_key text not null,
  src text not null,
  default_layer text not null,
  default_scale numeric,
  default_origin_x numeric,
  default_origin_y numeric,
  default_collider jsonb,
  allowed_scene_types text[] not null,
  tags text[] default '{}',
  economy jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  asset_id text not null references asset_catalog(id),
  acquired_at timestamptz default now(),
  source text,
  quantity int default 1,
  metadata jsonb default '{}',
  unique(user_id, asset_id)
);

create table if not exists land_plots (
  id uuid primary key default gen_random_uuid(),
  world_id text not null default 'main',
  name text,
  bounds jsonb not null,
  anchor_x numeric not null,
  anchor_y numeric not null,
  size_w numeric,
  size_h numeric,
  owner_id uuid,
  status text not null default 'empty',
  price numeric,
  allowed_building_types text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  scene_key text unique,
  scene_type text not null,
  template_id text,
  owner_id uuid,
  name text,
  version int not null default 1,
  published_version int not null default 1,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists player_houses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  land_plot_id uuid not null references land_plots(id),
  building_asset_id text not null references asset_catalog(id),
  indoor_scene_id uuid references scenes(id),
  name text,
  status text not null default 'active',
  permissions jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists scene_objects (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  asset_id text references asset_catalog(id),
  kind text not null,
  layer text not null,
  position jsonb not null,
  transform jsonb default '{}',
  depth jsonb default '{}',
  collider jsonb,
  interaction jsonb,
  portal jsonb,
  owner_id uuid,
  locked boolean default false,
  metadata jsonb default '{}',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists scene_permissions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  owner_id uuid,
  editors uuid[] default '{}',
  visitor_policy text not null default 'public',
  can_move_objects boolean default false,
  can_place_objects boolean default false,
  can_delete_objects boolean default false,
  can_invite_npc boolean default false,
  metadata jsonb default '{}'
);

create table if not exists scene_edit_commands (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  user_id uuid not null,
  command_type text not null,
  object_id uuid,
  payload jsonb not null,
  client_id text,
  created_at timestamptz default now()
);

create index if not exists idx_scene_objects_scene_id on scene_objects(scene_id);
create index if not exists idx_scene_objects_asset_id on scene_objects(asset_id);
create index if not exists idx_land_plots_owner_id on land_plots(owner_id);
create index if not exists idx_player_houses_owner_id on player_houses(owner_id);
create index if not exists idx_scene_edit_commands_scene_id on scene_edit_commands(scene_id);

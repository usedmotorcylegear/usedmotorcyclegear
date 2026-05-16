-- Run this entire script in Supabase > SQL Editor

-- Profiles table (one per user)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  location text,
  phone text,
  created_at timestamp with time zone default now()
);

-- Listings table
create table listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  price decimal(10,2) not null,
  category text not null,
  condition text not null,
  location text,
  images text[],
  status text default 'active',
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table listings enable row level security;

-- Profile policies
create policy "Profiles are public" on profiles for select using (true);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Listing policies
create policy "Active listings are public" on listings for select using (status = 'active');
create policy "Users insert own listings" on listings for insert with check (auth.uid() = user_id);
create policy "Users update own listings" on listings for update using (auth.uid() = user_id);
create policy "Users delete own listings" on listings for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

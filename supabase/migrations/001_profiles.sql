-- 001: profiles table + RLS + auto-create trigger
-- Run in the Supabase SQL editor or via `npx supabase db push`.

create table if not exists public.profiles (
    id              uuid primary key references auth.users on delete cascade,
    is_pro          boolean default false,
    preferred_voice text,
    preferred_rate  float default 1.0,
    app_language    text default 'en',
    created_at      timestamptz default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
    for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- Rows are inserted by this trigger only (security definer), so no INSERT policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id) values (new.id);
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

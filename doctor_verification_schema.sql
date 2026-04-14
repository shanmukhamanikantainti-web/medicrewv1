-- =============================================
-- MediCrew: Doctor Verification Table
-- Run this in Supabase SQL Editor
-- =============================================

create table if not exists public.doctor_verifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade,
  email             text not null,
  full_name         text not null,

  -- Academic
  degree            text not null,
  university        text not null,
  graduation_year   int  not null,
  license_number    text not null,
  specialization    text not null,

  -- Hospital
  hospital_name     text not null,
  hospital_reg_no   text not null,
  hospital_address  text not null,
  hospital_city     text not null,
  hospital_state    text not null,
  experience_years  int  not null default 0,

  -- Admin workflow
  status            text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected')),
  admin_notes       text,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.doctor_verifications enable row level security;

-- Doctors can read their own record
create policy "Doctor reads own verification" on public.doctor_verifications
  for select using (user_id = auth.uid());

-- Admins can view and update all
create policy "Admins manage verifications" on public.doctor_verifications
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superadmin')
    )
  );

-- Allow insert from anon/authenticated during signup
create policy "Insert own verification" on public.doctor_verifications
  for insert with check (user_id = auth.uid());

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_doctor_verifications_updated_at on public.doctor_verifications;
create trigger trg_doctor_verifications_updated_at
  before update on public.doctor_verifications
  for each row execute procedure public.set_updated_at();

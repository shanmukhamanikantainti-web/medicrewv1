-- =============================================
-- MediCrew Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles ──────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'patient' check (role in ('patient', 'doctor', 'admin', 'superadmin')),
  verified boolean default false,
  previous_role text,
  temp_admin_expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'superadmin')
    )
  );

create policy "Insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- ── Devices ───────────────────────────────────
create table if not exists public.devices (
  id uuid primary key default uuid_generate_v4(),
  device_id text unique not null,
  patient_id uuid references public.profiles(id) on delete set null,
  status text default 'inactive' check (status in ('active', 'inactive')),
  last_sync timestamptz,
  heart_rate int,
  spo2 int,
  temperature numeric(4,1),
  bp text,
  ip_address text,
  created_at timestamptz default now()
);

alter table public.devices enable row level security;

create policy "Patients view own devices" on public.devices
  for select using (patient_id = auth.uid());

create policy "Patients can link devices" on public.devices
  for all using (patient_id = auth.uid() or patient_id is null);

create policy "Admins manage all devices" on public.devices
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

-- ── Appointments ──────────────────────────────
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.profiles(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  date date not null,
  time time,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz default now()
);

alter table public.appointments enable row level security;

create policy "Patients see own appointments" on public.appointments
  for select using (patient_id = auth.uid());

create policy "Doctors see their appointments" on public.appointments
  for select using (doctor_id = auth.uid());

create policy "Patients create appointments" on public.appointments
  for insert with check (patient_id = auth.uid());

create policy "Doctors update appointment status" on public.appointments
  for update using (doctor_id = auth.uid() or patient_id = auth.uid());

create policy "Admins view all appointments" on public.appointments
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

-- ── AI Results ────────────────────────────────
create table if not exists public.ai_results (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.profiles(id) on delete cascade,
  symptoms text,
  condition text,
  urgency text,
  first_aid jsonb,
  disclaimer text,
  created_at timestamptz default now()
);

alter table public.ai_results enable row level security;

create policy "Patients view own AI results" on public.ai_results
  for select using (patient_id = auth.uid());

create policy "Patients insert AI results" on public.ai_results
  for insert with check (patient_id = auth.uid());

-- ── Audit Logs ────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

create policy "Admins can view audit logs" on public.audit_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

create policy "Admins can insert audit logs" on public.audit_logs
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

-- =============================================
-- MediCrew: Fix Recursive RLS + Auto-Profile Trigger
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================

-- ── STEP 1: Drop the broken recursive admin policy ─────
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- ── STEP 2: Create a SECURITY DEFINER function to check admin role ──
-- This bypasses RLS to avoid the infinite recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── STEP 3: Re-create the admin policy using the function ──
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR ALL USING (
    public.get_my_role() IN ('admin', 'superadmin')
  );

-- ── STEP 4: Fix similar recursive policies on other tables ──
DROP POLICY IF EXISTS "Admins manage all devices" ON public.devices;
CREATE POLICY "Admins manage all devices" ON public.devices
  FOR ALL USING (public.get_my_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
CREATE POLICY "Admins view all appointments" ON public.appointments
  FOR SELECT USING (public.get_my_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.get_my_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- ── STEP 5: Auto-create profile on new user signup ──────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING; -- Safe if profile already exists
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then re-create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── STEP 6: Backfill profiles for existing users without one ──
INSERT INTO public.profiles (id, email, full_name, role, verified)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'role', 'patient'),
  FALSE
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify: check all auth users now have profiles
SELECT u.email, p.role, p.verified
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

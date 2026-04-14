-- =============================================
-- MediCrew: PERMANENT RLS + Profile Fix
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================

-- ── STEP 1: Drop ALL existing profile policies ──────────────
DROP POLICY IF EXISTS "Users can view their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile"                ON public.profiles;

-- ── STEP 2: Drop other recursive policies ───────────────────
DROP POLICY IF EXISTS "Admins manage all devices"    ON public.devices;
DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can view audit logs"   ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

-- ── STEP 3: Helper function (non-recursive admin check) ─────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── STEP 4: RPC to fetch own profile (bypasses RLS deadlock) ─
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── STEP 5: RPC to upsert own profile (bypasses RLS deadlock) ─
CREATE OR REPLACE FUNCTION public.upsert_my_profile(
  p_email     text,
  p_full_name text,
  p_role      text    DEFAULT 'patient',
  p_verified  boolean DEFAULT false
)
RETURNS SETOF public.profiles LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  INSERT INTO public.profiles (id, email, full_name, role, verified)
  VALUES (auth.uid(), p_email, p_full_name, p_role, p_verified)
  ON CONFLICT (id) DO UPDATE SET
    email      = COALESCE(EXCLUDED.email,      profiles.email),
    full_name  = COALESCE(EXCLUDED.full_name,  profiles.full_name),
    role       = COALESCE(EXCLUDED.role,       profiles.role)
  RETURNING *;
$$;

-- ── STEP 6: Recreate clean, non-recursive profile policies ───
CREATE POLICY "select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert_own"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_all"    ON public.profiles FOR ALL
  USING (public.get_my_role() IN ('admin', 'superadmin'));

-- ── STEP 7: Fix other tables ─────────────────────────────────
CREATE POLICY "Admins manage all devices" ON public.devices FOR ALL
  USING (public.get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins view all appointments" ON public.appointments FOR SELECT
  USING (public.get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT
  USING (public.get_my_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'superadmin'));

-- ── STEP 8: Auto-create profile on signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, verified)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    FALSE
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── STEP 9: Backfill missing profiles ────────────────────────
INSERT INTO public.profiles (id, email, full_name, role, verified)
SELECT u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
  COALESCE(u.raw_user_meta_data->>'role', 'patient'), FALSE
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── Verify: all users should now have profiles ────────────────
SELECT u.email, p.role, p.verified
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

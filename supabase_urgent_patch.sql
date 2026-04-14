-- =============================================
-- MediCrew: URGENT PATCH — Run this NOW
-- Supabase Dashboard → SQL Editor → New Query → Run All
-- Only about 30 seconds to execute
-- =============================================

-- ── 1. Safe non-recursive role check ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 2. RPC: Fetch own profile (bypasses ALL RLS policies) ─────
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 3. RPC: Upsert own profile (bypasses ALL RLS policies) ────
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
    email     = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name)
  RETURNING *;
$$;

-- ── 4. Drop ALL existing profile SELECT/INSERT/UPDATE policies ─
-- (covers any leftover recursive ones from original schema)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- ── 5. Recreate clean, verified, non-recursive policies ───────
CREATE POLICY "own_select"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_insert"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_update"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_select" ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'superadmin'));
CREATE POLICY "admin_all"    ON public.profiles FOR ALL
  USING (public.get_my_role() IN ('admin', 'superadmin'));

-- ── 6. Auto-create profile trigger for ALL new signups ────────
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
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 7. Backfill ALL existing users who are missing a profile ──
INSERT INTO public.profiles (id, email, full_name, role, verified)
SELECT
  u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
  COALESCE(u.raw_user_meta_data->>'role', 'patient'),
  FALSE
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── Verify: every user should have a profile row ──────────────
SELECT u.email, p.role, p.verified, p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

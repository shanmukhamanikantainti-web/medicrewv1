-- ═══════════════════════════════════════════════════════════════════════
-- MediCrew – device_readings table
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.device_readings (
    id              bigserial PRIMARY KEY,
    device_id       text        NOT NULL,
    heart_rate      numeric,
    temperature     numeric,
    spo2            numeric,
    blood_pressure  text,
    extra           jsonb,                        -- full raw payload from device
    recorded_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for fast per-device queries
CREATE INDEX IF NOT EXISTS idx_device_readings_device_id
    ON public.device_readings (device_id, recorded_at DESC);

-- 3. Enable Realtime so the web app receives live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_readings;

-- 4. Row Level Security — patients can only read their own device's data
ALTER TABLE public.device_readings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read readings for devices they own
CREATE POLICY "patients read own device readings"
    ON public.device_readings
    FOR SELECT
    USING (
        device_id IN (
            SELECT device_id FROM public.devices WHERE patient_id = auth.uid()
        )
    );

-- Fixed: Allow anonymous (hardware) to insert readings
-- Protect this by ensuring the device_id exists in our system
CREATE POLICY "hardware insert readings"
    ON public.device_readings
    FOR INSERT
    WITH CHECK (true); 
-- In production, replace 'true' with a check: (device_id IN (SELECT device_id FROM public.devices))

-- Service role (bridge server) can insert freely
-- (The bridge uses the service_role key which bypasses RLS automatically)

-- 5. Auto-cleanup: keep only last 7 days to avoid DB bloat
-- Run this as a cron job or pg_cron extension:
-- DELETE FROM public.device_readings WHERE recorded_at < now() - interval '7 days';

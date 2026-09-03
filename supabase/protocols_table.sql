-- ============================================================
-- SERVIO POS — Protocols Table Setup & Seed Data
-- ============================================================
-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create the protocols table
CREATE TABLE IF NOT EXISTS public.protocols (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Auto-update updated_at timestamp on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protocols_updated_at ON public.protocols;
CREATE TRIGGER protocols_updated_at
  BEFORE UPDATE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Row-Level Security (RLS)
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

-- Allow anon (for local development, demo POS stations, and Protocol Assistant chatbot)
DROP POLICY IF EXISTS "Anyone can read protocols" ON public.protocols;
CREATE POLICY "Anyone can read protocols"
  ON public.protocols FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon can manage protocols" ON public.protocols;
CREATE POLICY "Anon can manage protocols"
  ON public.protocols FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow authenticated staff / admin users
DROP POLICY IF EXISTS "Authenticated users can manage protocols" ON public.protocols;
CREATE POLICY "Authenticated users can manage protocols"
  ON public.protocols FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Enable Realtime Replication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.protocols;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Seed Core Restaurant Protocols
INSERT INTO public.protocols (title, content) VALUES
  ('Medical Emergency Protocol',
   '1. Stay calm. Assess the situation quickly: Is the guest conscious? Are they breathing? Do they appear in severe distress?
2. Call 911 immediately if the guest shows chest pain, breathing difficulties, loss of consciousness, seizure, signs of stroke, or uncontrollable bleeding.
3. Do not leave the guest alone. Assign one staff member to stay with them at all times.
4. Notify the shift lead or manager immediately.
5. Clear the area around the guest to provide privacy and space for first aid.
6. If the guest is unconscious and not breathing, begin CPR immediately if certified, and retrieve the AED.
7. Direct emergency responders upon arrival and submit a comprehensive incident report.'),

  ('Fire Emergency Protocol',
   '1. Remain calm. Alert all staff and guests immediately with a clear, calm voice.
2. Pull the nearest fire alarm manual station.
3. Call 911 and provide the restaurant address and exact location of the fire.
4. If the fire is small and contained (e.g., small trash bin) and you are trained, use the proper class fire extinguisher (PASS: Pull, Aim, Squeeze, Sweep).
5. For kitchen grease fires, trigger the Ansul kitchen suppression system and NEVER pour water on a grease fire.
6. Guide guests to the nearest emergency exits; do not use elevators.
7. Gather at the designated outdoor assembly point and conduct staff and guest headcount.'),

  ('Allergic Reaction Protocol',
   '1. Ask the guest if they have a known allergy and whether they carry an EpiPen / auto-injector.
2. If the guest is experiencing severe symptoms (throat swelling, wheezing, hives, dizziness), call 911 immediately.
3. Assist the guest in administering their EpiPen if they request assistance and are unable to do so themselves.
4. Retain the dish served, ticket, and ingredient packaging to assist medical personnel.
5. Keep the guest comfortably seated and do not offer water or food.'),

  ('Food Contamination Protocol',
   '1. Immediately stop serving the suspect batch or menu item.
2. Label and quarantine all remaining food in the walk-in refrigerator marked "DO NOT USE - QUARANTINED".
3. Report the incident to the Head Chef and General Manager immediately.
4. Document batch numbers, supplier delivery dates, and refrigeration temperature logs.
5. Apologize sincerely to the affected guest, replace the meal with an alternative if safe, and record their contact info for follow-up.'),

  ('Cash Handling and Register Protocol',
   '1. Verify and sign off on the starting cash float at the opening of each shift.
2. Keep the register drawer closed and locked at all times when not actively tendering cash.
3. Count customer change in plain view of the customer and camera.
4. Perform supervisor drops whenever cash in drawer exceeds the standard threshold (₱10,000).
5. Count and reconcile drawer totals at the end of the shift with the Z-reading / end-of-day summary.'),

  ('Kitchen Safety and Hygiene Protocol',
   '1. Wash hands with warm water and soap for at least 20 seconds before handling food, after touching raw meat, and after breaks.
2. Wear proper head coverings, non-slip shoes, and clean aprons at all times in the kitchen area.
3. Keep raw meats, poultry, and seafood strictly separated from ready-to-eat foods to prevent cross-contamination.
4. Maintain hot foods above 60°C (140°F) and cold foods below 4°C (40°F).
5. Clean and sanitize prep tables, cutting boards, and knives between tasks.')
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content;

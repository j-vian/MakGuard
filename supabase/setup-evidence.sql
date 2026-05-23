-- Run this in Supabase Dashboard → SQL Editor
-- Enables evidence images on community reports (column + storage bucket)

-- 1. Column for public evidence URLs in the threat registry
ALTER TABLE public.scam_reports
ADD COLUMN IF NOT EXISTS evidence_url text;

-- 2. Public storage bucket for report screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage policy: public read only (uploads use /api/report/evidence + service role)
DROP POLICY IF EXISTS "Public read evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload evidence reports" ON storage.objects;

CREATE POLICY "Public read evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'evidence');

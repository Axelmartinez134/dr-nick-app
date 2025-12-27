-- Allow public (unauthenticated) reads of objects in the `carousel-templates` bucket.
-- This is required so browser requests to:
--   /storage/v1/object/public/carousel-templates/<path>
-- can succeed without a JWT.

-- Ensure RLS is enabled on storage.objects (it usually is by default in Supabase projects)
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to keep this migration idempotent.
DROP POLICY IF EXISTS "Public read carousel templates bucket" ON storage.objects;

CREATE POLICY "Public read carousel templates bucket"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'carousel-templates');

-- Also allow the Postgres `public` role just in case your project maps unauthenticated requests differently.
DROP POLICY IF EXISTS "Public role read carousel templates bucket" ON storage.objects;

CREATE POLICY "Public role read carousel templates bucket"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'carousel-templates');



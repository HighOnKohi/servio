-- ==============================================================================
-- Migration: Menu Item Image Uploads & Supabase Storage Configuration
-- Date: 2026-09-04
-- Purpose: 
--   1. Ensures public.menu_items has an image_url column.
--   2. Configures the 'menu-items' public storage bucket in Supabase Storage.
--   3. Configures Row Level Security (RLS) policies allowing public image reads
--      and authorized uploads/deletions.
-- ==============================================================================

-- 1. Ensure public.menu_items table has the image_url column
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create the 'menu-items' public bucket in Supabase Storage if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-items',
  'menu-items',
  TRUE,
  5242880, -- 5 MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Configure Storage Row Level Security (RLS) Policies on storage.objects

-- Allow anyone (public and authenticated users) to view/read menu item photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
      AND schemaname = 'storage' 
      AND policyname = 'Public Access for menu-items bucket'
  ) THEN
    CREATE POLICY "Public Access for menu-items bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'menu-items');
  END IF;
END $$;

-- Allow upload of images to the menu-items bucket (anon & authenticated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
      AND schemaname = 'storage' 
      AND policyname = 'Allow upload to menu-items bucket'
  ) THEN
    CREATE POLICY "Allow upload to menu-items bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'menu-items');
  END IF;
END $$;

-- Allow updating images in the menu-items bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
      AND schemaname = 'storage' 
      AND policyname = 'Allow update to menu-items bucket'
  ) THEN
    CREATE POLICY "Allow update to menu-items bucket"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'menu-items')
    WITH CHECK (bucket_id = 'menu-items');
  END IF;
END $$;

-- Allow deleting images from the menu-items bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
      AND schemaname = 'storage' 
      AND policyname = 'Allow delete from menu-items bucket'
  ) THEN
    CREATE POLICY "Allow delete from menu-items bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'menu-items');
  END IF;
END $$;

-- Verification query (uncomment to test bucket creation):
-- SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'menu-items';

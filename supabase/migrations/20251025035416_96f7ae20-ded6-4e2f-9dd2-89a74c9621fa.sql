-- Add QR slug and guest chat settings to profiles
ALTER TABLE public.profiles
ADD COLUMN qr_slug text,
ADD COLUMN max_guest_hours int NOT NULL DEFAULT 6,
ADD COLUMN qr_rotated_at timestamptz;

-- Function to generate random URL-safe base62-style slug
CREATE OR REPLACE FUNCTION generate_qr_slug()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing profiles with unique slugs
DO $$
DECLARE
  profile_record RECORD;
  new_slug text;
  slug_exists boolean;
BEGIN
  FOR profile_record IN SELECT id FROM public.profiles WHERE qr_slug IS NULL OR qr_slug = '' LOOP
    LOOP
      new_slug := generate_qr_slug();
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE qr_slug = new_slug) INTO slug_exists;
      EXIT WHEN NOT slug_exists;
    END LOOP;
    UPDATE public.profiles SET qr_slug = new_slug WHERE id = profile_record.id;
  END LOOP;
END;
$$;

-- Now make qr_slug NOT NULL after backfill
ALTER TABLE public.profiles
ALTER COLUMN qr_slug SET NOT NULL,
ALTER COLUMN qr_slug SET DEFAULT '';

-- Create unique index on qr_slug
CREATE UNIQUE INDEX profiles_qr_slug_idx ON public.profiles(qr_slug);

-- Helper function to look up profile by qr_slug
CREATE OR REPLACE FUNCTION public.get_profile_by_qr_slug(slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE qr_slug = slug LIMIT 1;
$$;
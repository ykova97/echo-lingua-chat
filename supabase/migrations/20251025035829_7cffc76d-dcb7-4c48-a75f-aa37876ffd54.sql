-- Make invite_id nullable for QR slug-based guest sessions
ALTER TABLE public.guest_sessions
ALTER COLUMN invite_id DROP NOT NULL;
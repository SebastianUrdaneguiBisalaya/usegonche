-- Manual SQL (applied by the user on Supabase, never by the agent).
-- Replaces the `handle_new_auth_user` function so the profile is created with its display name:
-- `display_name` (sent by the web sign-up form), or `full_name` / `name` (Google).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    left(
      nullif(
        btrim(
          coalesce(
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            ''
          )
        ),
        ''
      ),
      100
    ),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

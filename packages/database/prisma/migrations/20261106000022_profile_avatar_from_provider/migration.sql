-- Applied by the user on Supabase (never by the agent). Idempotent.
-- Replaces the `handle_new_auth_user` function so the profile is also created with the provider's picture:
-- `avatar_url` or `picture` (Google), only when it is an http(s) URL. The display name logic is unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  provider_avatar text := btrim(coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''));
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, updated_at)
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
    CASE WHEN provider_avatar ~* '^https?://' THEN provider_avatar END,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

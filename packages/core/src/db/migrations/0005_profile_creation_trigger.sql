-- Creates a public.profiles row whenever Supabase Auth creates a user.
--
-- Originally created by hand in the Supabase SQL editor; versioned here so
-- fresh databases get it. Idempotent: on databases that already have the
-- function and trigger, this replaces them with identical behavior plus the
-- search_path fix below.
--
-- SECURITY DEFINER: runs as the function owner (postgres), not as Supabase
-- Auth's role. The insert succeeds despite FORCE ROW LEVEL SECURITY on
-- profiles only because postgres has BYPASSRLS — no user context exists
-- during signup.
--
-- search_path = '': a privileged function must not resolve names through a
-- caller-controlled search path. Every object is therefore schema-qualified.
--
-- Known limit: auth.users.email is nullable but profiles.email is NOT NULL,
-- so phone or anonymous sign-ins would fail here. Email signup only for now.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();

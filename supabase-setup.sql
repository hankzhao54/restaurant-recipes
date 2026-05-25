-- ════════════════════════════════════════════════════════════════════════════
-- 101 Kitchen Recipes — Supabase Schema Setup
-- Run this once in the SQL Editor before importing seed data.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles table (extends auth.users with role + display name) ────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','chef','staff')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipes table — ingredients & steps as JSONB arrays ─────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id            TEXT PRIMARY KEY,
  hu_name       TEXT NOT NULL,
  en_name       TEXT NOT NULL,
  category      INT  NOT NULL DEFAULT 0,
  section       INT  DEFAULT 0,
  serves        INT  DEFAULT 4,
  prep_time     INT  DEFAULT 15,
  cook_time     INT  DEFAULT 30,
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name   TEXT,
  cover_image   TEXT,
  ingredients   JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seed       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_category   ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

-- ── Audit log table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  action        TEXT NOT NULL,
  recipe_id     TEXT,
  recipe_name   TEXT,
  diff          JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);

-- ── Updated-at trigger for recipes ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON recipes;
CREATE TRIGGER trg_recipes_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function: is current user admin?
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT current_user_role() = 'admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Profiles policies
DROP POLICY IF EXISTS "Anyone authenticated can read profiles" ON profiles;
CREATE POLICY "Anyone authenticated can read profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin());

-- Recipes policies
DROP POLICY IF EXISTS "Anyone authenticated can read recipes" ON recipes;
CREATE POLICY "Anyone authenticated can read recipes" ON recipes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Chefs and admins can insert recipes" ON recipes;
CREATE POLICY "Chefs and admins can insert recipes" ON recipes
  FOR INSERT WITH CHECK (current_user_role() IN ('admin','chef'));

DROP POLICY IF EXISTS "Chefs and admins can update recipes" ON recipes;
CREATE POLICY "Chefs and admins can update recipes" ON recipes
  FOR UPDATE USING (current_user_role() IN ('admin','chef'));

DROP POLICY IF EXISTS "Chefs and admins can delete recipes" ON recipes;
CREATE POLICY "Chefs and admins can delete recipes" ON recipes
  FOR DELETE USING (current_user_role() IN ('admin','chef'));

-- Audit log policies
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON audit_log;
CREATE POLICY "Authenticated users can insert audit entries" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can read audit log" ON audit_log;
CREATE POLICY "Admins can read audit log" ON audit_log
  FOR SELECT USING (is_admin());

-- ── RPC function: admin creates a new user account ──────────────────────────
-- Called from the app's Admin Panel → Users → Add user
CREATE OR REPLACE FUNCTION admin_create_user(
  p_username TEXT,
  p_password TEXT,
  p_display_name TEXT,
  p_role TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_email   TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  IF p_role NOT IN ('admin','chef','staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username) THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;

  v_email := p_username || '@restaurant.local';

  -- Create the auth user
  v_user_id := extensions.uuid_generate_v4();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  );

  -- Create the profile
  INSERT INTO profiles (id, username, display_name, role)
  VALUES (v_user_id, p_username, p_display_name, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC function: admin changes a user's password ───────────────────────────
CREATE OR REPLACE FUNCTION admin_change_password(
  p_user_id UUID,
  p_new_password TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC function: admin deletes a user ──────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  -- Ensure at least one admin remains
  IF (SELECT role FROM profiles WHERE id = p_user_id) = 'admin'
     AND (SELECT COUNT(*) FROM profiles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Cannot delete the last admin';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Grant execute permission on RPC functions ───────────────────────────────
GRANT EXECUTE ON FUNCTION admin_create_user   TO authenticated;
GRANT EXECUTE ON FUNCTION admin_change_password TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user   TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role   TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin            TO authenticated;

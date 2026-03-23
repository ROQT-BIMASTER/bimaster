
-- Table to assign access profiles to users
CREATE TABLE public.erp_portal_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES erp_portal_access_profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.erp_portal_user_profiles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user-profile assignments
CREATE POLICY "Admins manage user profiles"
  ON public.erp_portal_user_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own assignment
CREATE POLICY "Users read own profile"
  ON public.erp_portal_user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- app_user_connections: server-only (encrypted credentials must never reach clients)
REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
GRANT ALL ON public.app_user_connections TO service_role;

DROP POLICY IF EXISTS "No client access to connection credentials" ON public.app_user_connections;
CREATE POLICY "No client access to connection credentials"
  ON public.app_user_connections
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- executive_profiles: owner-scoped management
GRANT SELECT, INSERT, UPDATE ON public.executive_profiles TO authenticated;
REVOKE ALL ON public.executive_profiles FROM anon;
GRANT ALL ON public.executive_profiles TO service_role;

DROP POLICY IF EXISTS "Executivos criam o proprio perfil" ON public.executive_profiles;
CREATE POLICY "Executivos criam o proprio perfil"
  ON public.executive_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Executivos atualizam o proprio perfil" ON public.executive_profiles;
CREATE POLICY "Executivos atualizam o proprio perfil"
  ON public.executive_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
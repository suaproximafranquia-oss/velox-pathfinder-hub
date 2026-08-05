DROP POLICY IF EXISTS "creative_templates_read" ON public.creative_templates;

CREATE POLICY "creative_templates_read"
ON public.creative_templates
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.creative_templates FROM anon;
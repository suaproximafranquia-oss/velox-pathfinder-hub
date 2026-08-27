CREATE OR REPLACE FUNCTION public.resolve_portal_identity(_name text, _email text, _phone text, _origin text DEFAULT 'Portal Velox'::text, _material text DEFAULT ''::text, _scope text DEFAULT 'portal'::text, _executive_id text DEFAULT NULL::text, _executive_slug text DEFAULT NULL::text, _personalized boolean DEFAULT false, _campaign text DEFAULT NULL::text, _device text DEFAULT NULL::text, _city text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone_key text := public.portal_phone_key(_phone);
  v_email_key text := public.portal_email_key(_email);
  v_identity_key text;
  v_by_phone record;
  v_by_email record;
  v_target record;
  v_created boolean := false;
  v_conflict jsonb := NULL;
  v_alternates jsonb;
  v_now timestamptz := now();
BEGIN
  IF v_phone_key IS NULL AND v_email_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_invalid');
  END IF;

  -- Estrutura dos records definida antes de qualquer leitura condicional.
  SELECT * INTO v_by_phone FROM public.portal_leads WHERE false;
  SELECT * INTO v_by_email FROM public.portal_leads WHERE false;
  SELECT * INTO v_target FROM public.portal_leads WHERE false;

  IF v_phone_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('portal:phone:' || v_phone_key, 0));
  END IF;
  IF v_email_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('portal:email:' || v_email_key, 0));
  END IF;

  IF v_phone_key IS NOT NULL THEN
    SELECT * INTO v_by_phone FROM public.portal_leads l
    WHERE right(regexp_replace(l.whatsapp, '\D', '', 'g'), 11) = v_phone_key
    ORDER BY (l.relationship_started_at IS NOT NULL) DESC,
             l.last_activity_at DESC NULLS LAST,
             l.created_at ASC,
             l.id ASC
    LIMIT 1;
  END IF;

  IF v_email_key IS NOT NULL THEN
    SELECT * INTO v_by_email FROM public.portal_leads l
    WHERE lower(btrim(l.email)) = v_email_key
    ORDER BY (l.relationship_started_at IS NOT NULL) DESC,
             l.last_activity_at DESC NULLS LAST,
             l.created_at ASC,
             l.id ASC
    LIMIT 1;
  END IF;

  IF v_by_phone.id IS NOT NULL THEN
    v_target := v_by_phone;
  ELSIF v_by_email.id IS NOT NULL THEN
    v_target := v_by_email;
  END IF;

  IF v_target.id IS NULL THEN
    v_identity_key := CASE WHEN v_phone_key IS NOT NULL
                           THEN 'p:' || v_phone_key
                           ELSE 'e:' || v_email_key END;

    INSERT INTO public.portal_leads (
      id, name, email, whatsapp, city, origin, material, scope,
      personalized, responsible_executive_id, responsible_executive_slug,
      campaign, device, identity_key, created_at, last_activity_at
    ) VALUES (
      'ld_' || replace(gen_random_uuid()::text, '-', ''),
      coalesce(nullif(btrim(_name), ''), 'Investidor'),
      coalesce(v_email_key, ''),
      coalesce(btrim(_phone), ''),
      coalesce(_city, ''),
      coalesce(_origin, 'Portal Velox'),
      coalesce(_material, ''),
      coalesce(_scope, 'portal'),
      coalesce(_personalized, false),
      _executive_id,
      _executive_slug,
      _campaign,
      _device,
      v_identity_key,
      v_now,
      v_now
    )
    ON CONFLICT (identity_key) WHERE identity_key IS NOT NULL DO NOTHING
    RETURNING * INTO v_target;

    IF v_target.id IS NULL THEN
      SELECT * INTO v_target FROM public.portal_leads
      WHERE identity_key = v_identity_key LIMIT 1;
    ELSE
      v_created := true;
    END IF;
  END IF;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_unresolved');
  END IF;

  IF NOT v_created THEN
    v_alternates := coalesce(v_target.identity_alternates, '{}'::jsonb);

    IF v_email_key IS NOT NULL AND lower(btrim(v_target.email)) IS DISTINCT FROM v_email_key THEN
      v_alternates := jsonb_set(
        v_alternates, '{emails}',
        coalesce(v_alternates->'emails', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('value', v_email_key, 'at', v_now, 'source', 'portal')),
        true);
      v_conflict := coalesce(v_conflict, '{}'::jsonb) || jsonb_build_object(
        'email_divergente', v_email_key, 'at', v_now);
    END IF;

    IF v_phone_key IS NOT NULL
       AND right(regexp_replace(coalesce(v_target.whatsapp, ''), '\D', '', 'g'), 11) IS DISTINCT FROM v_phone_key THEN
      v_alternates := jsonb_set(
        v_alternates, '{phones}',
        coalesce(v_alternates->'phones', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('value', v_phone_key, 'at', v_now, 'source', 'portal')),
        true);
      v_conflict := coalesce(v_conflict, '{}'::jsonb) || jsonb_build_object(
        'telefone_divergente', v_phone_key, 'at', v_now);
    END IF;

    -- Identidade cruzada: e-mail pertence a outro cadastro.
    IF v_by_phone.id IS NOT NULL AND v_by_email.id IS NOT NULL
       AND v_by_phone.id IS DISTINCT FROM v_by_email.id THEN
      v_conflict := coalesce(v_conflict, '{}'::jsonb) || jsonb_build_object(
        'identidade_cruzada', jsonb_build_object(
          'lead_por_telefone', v_by_phone.id,
          'lead_por_email', v_by_email.id,
          'at', v_now));
      UPDATE public.portal_leads
         SET identity_conflict = coalesce(identity_conflict, '{}'::jsonb) || jsonb_build_object(
               'identidade_cruzada', jsonb_build_object(
                 'lead_por_telefone', v_by_phone.id,
                 'lead_por_email', v_by_email.id,
                 'at', v_now))
       WHERE id = v_by_email.id;
    END IF;

    UPDATE public.portal_leads
       SET identity_alternates = v_alternates,
           identity_conflict = CASE WHEN v_conflict IS NULL THEN identity_conflict
                                    ELSE coalesce(identity_conflict, '{}'::jsonb) || v_conflict END,
           last_activity_at = v_now
     WHERE id = v_target.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'investorId', v_target.id,
    'recognized', NOT v_created,
    'conflict', v_conflict IS NOT NULL
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.library_rename_step_key(
  p_scope text,
  p_from text,
  p_to text,
  p_title text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from text := upper(trim(p_from));
  v_to text := upper(trim(p_to));
  v_conflict integer;
  v_shift integer;
  v_moved integer;
  v_ctx text;
  v_target_id uuid;
BEGIN
  IF v_from = v_to THEN
    RETURN 0;
  END IF;

  -- Trava as linhas das duas chaves durante a operação (atômica).
  PERFORM 1 FROM public.relationship_message_library
   WHERE scope = p_scope AND step_key IN (v_from, v_to) FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.relationship_message_library
     WHERE scope = p_scope AND step_key = v_from
  ) THEN
    RAISE EXCEPTION 'Etapa % não encontrada na Biblioteca.', v_from;
  END IF;

  -- CONFLITO: o código de destino já pertence a outra etapa com mensagem
  -- (texto gravado ou versão ativa). Nada é sobrescrito nem misturado.
  SELECT count(*) INTO v_conflict
    FROM public.relationship_message_library
   WHERE scope = p_scope AND step_key = v_to
     AND (active OR length(trim(coalesce(body, ''))) > 0
          OR length(trim(coalesce(body_without_name, ''))) > 0);
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'O código % já está sendo utilizado por outra etapa da Biblioteca. Nenhuma alteração foi feita.', v_to
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Destino pode ter apenas slots estruturais vazios: as versões movidas
  -- entram DEPOIS deles, sem apagar nada e sem colidir numeração.
  SELECT coalesce(max(version), 0) INTO v_shift
    FROM public.relationship_message_library
   WHERE scope = p_scope AND step_key = v_to;

  UPDATE public.relationship_message_library
     SET step_key = v_to,
         purpose = lower(v_to),
         code = CASE WHEN code IS NULL THEN NULL ELSE regexp_replace(code, '(-)' || v_from || '$', '\1' || v_to) END,
         version = version + v_shift
   WHERE scope = p_scope AND step_key = v_from;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  -- Título: gravado na versão vigente de cada contexto da etapa movida.
  FOR v_ctx IN
    SELECT DISTINCT coalesce(step_context, '') FROM public.relationship_message_library
     WHERE scope = p_scope AND step_key = v_to
  LOOP
    SELECT id INTO v_target_id
      FROM public.relationship_message_library
     WHERE scope = p_scope AND step_key = v_to AND coalesce(step_context, '') = v_ctx
     ORDER BY active DESC, version DESC
     LIMIT 1;
    IF v_target_id IS NOT NULL AND p_title IS NOT NULL THEN
      UPDATE public.relationship_message_library SET title = p_title WHERE id = v_target_id;
    END IF;
  END LOOP;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.library_rename_step_key(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_rename_step_key(text, text, text, text) TO service_role;
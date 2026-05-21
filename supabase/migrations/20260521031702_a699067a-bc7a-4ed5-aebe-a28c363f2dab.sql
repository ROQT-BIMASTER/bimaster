
CREATE OR REPLACE FUNCTION public.calc_completeness(
  _empresa_id bigint,
  _tipo text,
  _payload jsonb
) RETURNS smallint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _secoes jsonb;
  _total int;
  _preenchidos int := 0;
  _key text;
  _val text;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RETURN 0;
  END IF;

  SELECT secoes INTO _secoes
  FROM public.briefing_templates
  WHERE tipo = _tipo AND ativo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF _secoes IS NULL OR jsonb_array_length(_secoes) = 0 THEN
    -- Sem template, conta apenas chaves não vazias do payload
    SELECT count(*) INTO _preenchidos
    FROM jsonb_each_text(_payload) e(k, v)
    WHERE coalesce(btrim(v), '') <> '';
    RETURN LEAST(100, _preenchidos * 10)::smallint;
  END IF;

  _total := jsonb_array_length(_secoes);

  FOR _key IN
    SELECT s->>'key' FROM jsonb_array_elements(_secoes) s WHERE s ? 'key'
  LOOP
    _val := _payload->>_key;
    IF _val IS NOT NULL AND btrim(_val) <> '' THEN
      _preenchidos := _preenchidos + 1;
    END IF;
  END LOOP;

  IF _total = 0 THEN
    RETURN 0;
  END IF;

  RETURN LEAST(100, ROUND((_preenchidos::numeric / _total) * 100))::smallint;
END;
$$;

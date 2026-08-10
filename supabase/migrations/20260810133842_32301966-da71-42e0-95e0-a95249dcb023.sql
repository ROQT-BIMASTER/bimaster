CREATE OR REPLACE FUNCTION public.aplicar_clientes_rp_no_master()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_resolvidos_ibge integer := 0;
BEGIN
  WITH src AS (
    SELECT
      r.codigo_erp,
      r.cnpj,
      COALESCE(NULLIF(TRIM(r.razao_social), ''), 'SEM NOME') AS nome,
      r.nome_fantasia,
      r.email, r.telefone, r.celular,
      r.endereco, r.bairro, r.cidade, r.uf, r.cep,
      r.data_cadastro,
      r.data_ultima_compra, r.valor_ultima_compra,
      r.data_maior_compra,  r.valor_maior_compra,
      r.vendedor_codigo, r.vendedor_nome,
      r.equipe_codigo,   r.equipe_nome,
      r.supervisor,
      r.classificacao,
      r.limite_credito,
      r.status_bloqueio,
      r.ibge_codigo,
      r.inativo,
      COALESCE(im_cod.id, im_nome.id) AS ibge_municipio_id
    FROM public.erp_clientes_raw r
    LEFT JOIN public.ibge_municipios im_cod
      ON r.ibge_codigo IS NOT NULL AND im_cod.id = r.ibge_codigo
    LEFT JOIN LATERAL (
      SELECT im.id
      FROM public.ibge_municipios im
      WHERE r.ibge_codigo IS NULL
        AND r.cidade IS NOT NULL AND r.uf IS NOT NULL
        AND im.uf_sigla = r.uf
        AND LOWER(TRIM(public.unaccent(im.nome))) = LOWER(TRIM(public.unaccent(r.cidade)))
      LIMIT 1
    ) im_nome ON true
  ),
  ups AS (
    INSERT INTO public.clientes AS c (
      codigo, cnpj, nome, nome_abreviado,
      email, telefone, celular,
      endereco, bairro, cidade, uf, cep,
      data_cadastro,
      data_ultima_compra, valor_ultima_compra,
      data_maior_compra,  valor_maior_compra,
      cod_vend, vendedor, cod_equipe, nome_equipe, supervisor,
      classificacao, limite_credito, status_bloqueio,
      ibge_municipio_id, codigo_ibge_municipio,
      sincronizado_em, updated_at
    )
    SELECT
      s.codigo_erp, s.cnpj, s.nome, s.nome_fantasia,
      s.email, s.telefone, s.celular,
      s.endereco, s.bairro, s.cidade, s.uf, s.cep,
      s.data_cadastro,
      s.data_ultima_compra, s.valor_ultima_compra,
      s.data_maior_compra,  s.valor_maior_compra,
      s.vendedor_codigo, s.vendedor_nome, s.equipe_codigo, s.equipe_nome, s.supervisor,
      s.classificacao, s.limite_credito, COALESCE(s.status_bloqueio, 'ativo'),
      s.ibge_municipio_id, s.ibge_codigo,
      now(), now()
    FROM src s
    ON CONFLICT (codigo) DO UPDATE SET
      cnpj                = EXCLUDED.cnpj,
      nome                = EXCLUDED.nome,
      nome_abreviado      = EXCLUDED.nome_abreviado,
      email               = EXCLUDED.email,
      telefone            = EXCLUDED.telefone,
      celular             = EXCLUDED.celular,
      endereco            = EXCLUDED.endereco,
      bairro              = EXCLUDED.bairro,
      cidade              = EXCLUDED.cidade,
      uf                  = EXCLUDED.uf,
      cep                 = EXCLUDED.cep,
      data_cadastro       = COALESCE(EXCLUDED.data_cadastro, c.data_cadastro),
      data_ultima_compra  = EXCLUDED.data_ultima_compra,
      valor_ultima_compra = EXCLUDED.valor_ultima_compra,
      data_maior_compra   = EXCLUDED.data_maior_compra,
      valor_maior_compra  = EXCLUDED.valor_maior_compra,
      cod_vend            = EXCLUDED.cod_vend,
      vendedor            = EXCLUDED.vendedor,
      cod_equipe          = EXCLUDED.cod_equipe,
      nome_equipe         = EXCLUDED.nome_equipe,
      supervisor          = EXCLUDED.supervisor,
      classificacao       = EXCLUDED.classificacao,
      limite_credito      = EXCLUDED.limite_credito,
      status_bloqueio     = EXCLUDED.status_bloqueio,
      ibge_municipio_id   = EXCLUDED.ibge_municipio_id,
      codigo_ibge_municipio = EXCLUDED.codigo_ibge_municipio,
      sincronizado_em     = now(),
      updated_at          = now()
    WHERE
      (c.cnpj, c.nome, c.nome_abreviado, c.email, c.telefone, c.celular,
       c.endereco, c.bairro, c.cidade, c.uf, c.cep,
       c.data_ultima_compra, c.valor_ultima_compra,
       c.data_maior_compra,  c.valor_maior_compra,
       c.cod_vend, c.vendedor, c.cod_equipe, c.nome_equipe, c.supervisor,
       c.classificacao, c.limite_credito, c.status_bloqueio,
       c.ibge_municipio_id, c.codigo_ibge_municipio)
      IS DISTINCT FROM
      (EXCLUDED.cnpj, EXCLUDED.nome, EXCLUDED.nome_abreviado, EXCLUDED.email,
       EXCLUDED.telefone, EXCLUDED.celular,
       EXCLUDED.endereco, EXCLUDED.bairro, EXCLUDED.cidade, EXCLUDED.uf, EXCLUDED.cep,
       EXCLUDED.data_ultima_compra, EXCLUDED.valor_ultima_compra,
       EXCLUDED.data_maior_compra,  EXCLUDED.valor_maior_compra,
       EXCLUDED.cod_vend, EXCLUDED.vendedor, EXCLUDED.cod_equipe, EXCLUDED.nome_equipe,
       EXCLUDED.supervisor,
       EXCLUDED.classificacao, EXCLUDED.limite_credito, EXCLUDED.status_bloqueio,
       EXCLUDED.ibge_municipio_id, EXCLUDED.codigo_ibge_municipio)
      OR c.data_cadastro IS DISTINCT FROM COALESCE(EXCLUDED.data_cadastro, c.data_cadastro)
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inseridos, v_atualizados
  FROM ups;

  SELECT COUNT(*) INTO v_resolvidos_ibge
  FROM public.clientes WHERE ibge_municipio_id IS NOT NULL;

  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'total_com_ibge', v_resolvidos_ibge,
    'aplicado_em', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.aplicar_clientes_rp_no_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_clientes_rp_no_master() TO service_role;
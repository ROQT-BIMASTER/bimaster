# Inteligência Municipal: correção dos gráficos + card "Share por Supervisor"

## 1. Por que os indicadores e gráficos pararam de carregar

Confirmado no banco: existem **duas versões** da função de indicadores (`fn_get_municipios_kpis`) —
a antiga com 5 filtros e a nova com 6 (incluindo vendedor). Quando a tela chama a função sem
informar o vendedor, o backend não consegue decidir qual das duas usar e devolve erro, deixando
os cartões de indicadores e o gráfico de cobertura vazios.

Correção: remover a versão antiga, mantendo apenas a que aceita o filtro de vendedor.

## 2. Novo card "Share por Supervisor"

Nova consulta no banco (`fn_get_share_supervisor`) com os mesmos filtros da tela
(UF, região, microrregião, busca, status), devolvendo por supervisor:

- total de clientes, total de municípios e total de vendedores;
- regras de agrupamento: código de vendedor 1000 vira "E-commerce (carteira automática)";
  supervisor vazio vira "Sem supervisor"; demais usam o nome do supervisor;
- ordenado por número de clientes (maior primeiro); acesso apenas para usuários autenticados.

Novo componente `SupervisorShareCard`:

- título "Share por Supervisor", descrição "Participação na base de clientes dos municípios filtrados";
- top 8 supervisores + linha "Outros (N supervisores)" agregada no frontend;
- por linha: nome truncado com tooltip, subtítulo "X mun. · Y vend.", barra horizontal proporcional,
  percentual e número de clientes à direita;
- barras em azul (primary) para supervisores reais; cinza (muted) para E-commerce, Sem supervisor e Outros;
- rodapé "N supervisores · M clientes"; skeleton de carregamento no mesmo padrão dos outros cards.

Layout: na linha de gráficos, a coluna esquerda passa a empilhar o donut de cobertura e o novo card
(`flex flex-col gap-4`), preenchendo o vão abaixo dele; Top 10 Oportunidades continua à direita.
Nenhuma alteração visual nos cards existentes.

## 3. Detalhes técnicos

- Migration A: `DROP FUNCTION public.fn_get_municipios_kpis(text, text, integer, text, text);`
- Migration B: `CREATE FUNCTION public.fn_get_share_supervisor(p_uf text, p_regiao text, p_microrregiao_id integer, p_search text, p_status text)`
  — `SECURITY DEFINER`, `SET search_path = public`, base
  `public.clientes c JOIN public.ibge_municipios im ON im.id = c.ibge_municipio_id`
  com o recorte padrão (`ibge_municipio_id IS NOT NULL AND LENGTH(TRIM(COALESCE(cnpj,''))) = 14`)
  e os mesmos filtros de município; `p_status` só restringe quando for `sem_clientes`/`virgem`
  (nesses casos não há clientes, retorno vazio). `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.
- `src/hooks/useMunicipiosIntelligence.ts`: novo `shareSupervisorQuery` com queryKey
  `['municipios-share-supervisor', ...filtros]`, interface `SupervisorShare`, exposto no retorno do hook.
- `src/components/comercial/municipios/ClientesSyncBadge.tsx`: incluir a nova queryKey na invalidação.
- `src/components/comercial/municipios/SupervisorShareCard.tsx`: componente novo (shadcn Card, tokens semânticos).
- `src/pages/MunicipiosIntelligence.tsx`: empilhar os dois cards na coluna esquerda.
- Bump de `APP_VERSION` em `src/lib/version.ts`.

## 4. Validação

- `SELECT * FROM public.fn_get_share_supervisor(NULL,NULL,NULL,NULL,NULL) LIMIT 10;`
  conferindo E-commerce no topo (~12,4k) e supervisores reais na sequência.
- Recarregar a tela e confirmar indicadores, donut de cobertura e Top 10 populados novamente.
- Filtrar por UF (ex.: PE) e confirmar que o novo card acompanha o filtro.

# PROMPT LOVABLE — Garantir acesso da Torre no menu + higiene corporativa do menu lateral

Como funciona o menu aqui (importante): o item de menu do módulo financeiro é **hardcoded** em
`src/components/dashboard/AppSidebar.tsx` (o item "Torre de Despesas" já entrou pela PR #22). Mas
o item **só aparece para quem tem a permissão da tela** — o sidebar filtra cada item pelo `screenCode`
via `useScreenPermissions`, e o acesso à rota é guardado por `ScreenProtectedRoute`. Portanto,
"garantir acesso" = garantir o **registro em `telas_sistema` + as permissões** (`role/usuario/departamento_permissoes_telas`).
Este prompt (1) reafirma o registro/permissão da Torre com os campos no padrão e (2) roda uma
**auditoria de higiene do menu** (a boa prática corporativa: nenhum item órfão, sem dono ou inconsistente).

---

## PARTE 1 — Garantir a Torre de Despesas registrada, ativa e permissionada (idempotente)

```sql
-- 1.1 Registro da tela (screenCode idêntico ao da rota App.tsx e do item do sidebar).
--     icone alinhado ao sidebar (TowerControl); acesso_padrao=false pois é tela sensível
--     (anti-fraude) — visibilidade é por concessão explícita, não aberta a todos.
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, icone, ativo, ordem, acesso_padrao)
VALUES ('financeiro_torre_despesas',
        'Torre de Despesas',
        'Torre de Controle de Despesas — variação por departamento (MoM/YoY), drill até o título, e fila de alertas de risco/fraude com trilha de auditoria.',
        '/dashboard/financeiro/torre-despesas',
        'financeiro', 'TowerControl', true, 12, false)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, rota = EXCLUDED.rota,
      modulo_codigo = EXCLUDED.modulo_codigo, icone = EXCLUDED.icone,
      ativo = true, ordem = EXCLUDED.ordem;

-- 1.2 Permissões — quem enxerga a tela.
--     (a) admin SEMPRE. (b) papéis/usuários/departamentos que já têm o MÓDULO financeiro herdam a tela.
--     Assim o item aparece pra equipe financeira e a rota libera; a FILA DE ALERTAS dentro da tela
--     continua restrita a admin/supervisor pela RLS de despesa_alertas (decisão de segurança).
WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, t.id FROM t
ON CONFLICT (role, tela_id) DO NOTHING;

WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT rpm.role, t.id
FROM public.role_permissoes_modulos rpm
JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
ON CONFLICT (role, tela_id) DO NOTHING;

WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT DISTINCT upm.usuario_id, t.id
FROM public.usuario_permissoes_modulos upm
JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
WHERE NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_telas x WHERE x.usuario_id = upm.usuario_id AND x.tela_id = t.id);

WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo = 'financeiro_torre_despesas')
INSERT INTO public.departamento_permissoes_telas (departamento_id, tela_id)
SELECT DISTINCT dpm.departamento_id, t.id
FROM public.departamento_permissoes_modulos dpm
JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id AND ms.codigo = 'financeiro'
CROSS JOIN t
WHERE NOT EXISTS (SELECT 1 FROM public.departamento_permissoes_telas x WHERE x.departamento_id = dpm.departamento_id AND x.tela_id = t.id);
```

> **Opção mais restrita (recomendada se a Torre for só do comando):** se preferir que a Torre apareça
> **apenas para admin/supervisor/gerente** (e não para todo o financeiro), pule os blocos (b) por-módulo
> e conceda só a esses papéis:
> ```sql
> WITH t AS (SELECT id FROM public.telas_sistema WHERE codigo='financeiro_torre_despesas')
> INSERT INTO public.role_permissoes_telas (role, tela_id)
> SELECT r::app_role, t.id FROM t, unnest(ARRAY['admin','supervisor','gerente']) r
> ON CONFLICT (role, tela_id) DO NOTHING;
> ```

---

## PARTE 2 — Auditoria de higiene do menu (a boa prática corporativa)

Rode e me traga o resultado. O objetivo é: **nenhuma tela ativa sem dono** (item que ninguém vê),
**nenhuma tela inativa ainda no ar**, e **cada tela do financeiro com acesso coerente**.

```sql
-- 2.1 A Torre está visível? Para quais papéis?
SELECT t.codigo, t.nome, t.ativo, t.acesso_padrao,
       array_agg(rpt.role::text ORDER BY rpt.role::text) AS papeis_com_acesso
FROM public.telas_sistema t
LEFT JOIN public.role_permissoes_telas rpt ON rpt.tela_id = t.id
WHERE t.codigo = 'financeiro_torre_despesas'
GROUP BY t.codigo, t.nome, t.ativo, t.acesso_padrao;

-- 2.2 ITENS MORTOS: telas ATIVAS, acesso_padrao=false e SEM nenhuma concessão (role/usuário/depto)
--     => só admin enxerga; para o resto é um item de menu que nunca aparece. Revisar.
SELECT t.codigo, t.nome, t.modulo_codigo, t.rota
FROM public.telas_sistema t
WHERE t.ativo = true AND t.acesso_padrao = false
  AND NOT EXISTS (SELECT 1 FROM public.role_permissoes_telas       r WHERE r.tela_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_telas    u WHERE u.tela_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.departamento_permissoes_telas d WHERE d.tela_id = t.id)
ORDER BY t.modulo_codigo, t.ordem;

-- 2.3 Telas INATIVAS que ainda têm permissão concedida (limpar concessão órfã).
SELECT t.codigo, t.nome, count(rpt.*) AS concessoes_role
FROM public.telas_sistema t
JOIN public.role_permissoes_telas rpt ON rpt.tela_id = t.id
WHERE t.ativo = false
GROUP BY t.codigo, t.nome;

-- 2.4 Panorama do módulo financeiro: cada tela, se está ativa e quantos papéis a veem
--     (ordenado por 'ordem' — como deve aparecer no menu).
SELECT t.ordem, t.codigo, t.nome, t.ativo,
       count(DISTINCT rpt.role) AS papeis
FROM public.telas_sistema t
LEFT JOIN public.role_permissoes_telas rpt ON rpt.tela_id = t.id
WHERE t.modulo_codigo = 'financeiro'
GROUP BY t.ordem, t.codigo, t.nome, t.ativo
ORDER BY t.ordem, t.codigo;

-- 2.5 (opcional) Telas duplicadas por rota (mesma rota, códigos diferentes = inconsistência).
SELECT rota, array_agg(codigo) codigos, count(*)
FROM public.telas_sistema WHERE ativo GROUP BY rota HAVING count(*) > 1;
```

---

## PARTE 3 — Boas práticas de menu já aplicadas (checklist) + o que fica no frontend

Aplicado por este prompt / pela PR #22:
- **screenCode único e idêntico** nos 3 lugares: rota (`App.tsx`), item do sidebar (`AppSidebar.tsx`) e `telas_sistema` → `financeiro_torre_despesas`. Sem isso o item some ou a rota dá 404.
- **Agrupamento lógico**: item dentro de "Análises e Relatórios" do financeiro, ao lado de "Visão Departamental".
- **Ícone distintivo e consistente** (`TowerControl`) entre sidebar e `telas_sistema`.
- **Visibilidade por permissão** (`acesso_padrao=false` + concessões) — item aparece só para quem deve; tela sensível não vaza no menu de todo mundo.
- **Nome curto e acionável** ("Torre de Despesas") + descrição clara no cadastro.

Fica no **frontend** (é código, o Claude aplica direto — não dá pra fazer por SQL):
- **Badge "Novo"** no item do sidebar (o tipo do item já suporta `badge`) para dar destaque à ferramenta nova por algumas semanas. Peça ao Claude para adicionar `badge: "Novo"` no item da Torre em `AppSidebar.tsx`.

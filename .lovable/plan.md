# Caixa de Entrada — Visões por Tipo de Projeto

Hoje a Caixa de Entrada (drawer global e tela `/dashboard/projetos/central?tab=inbox`) mostra **todas as origens** (Processos, Motor Artes, China, Aprovações, Composição, Embalagens, Amostras) para qualquer usuário, mesmo quem só trabalha em projetos genéricos. Isso polui a tela e enfraquece o foco.

A proposta é detectar o **perfil de trabalho** do usuário a partir dos projetos que ele acessa (campo `vinculado_produto` / `template`) e renderizar **uma de duas visões** — sem mexer em backend nem em RLS.

---

## Visão 1 — Produto (PMO)

Para quem participa de projetos vinculados a produto (template ≠ `generico`, ou `vinculado_produto` definido). É o usuário "fábrica/desenvolvimento".

**Caixas (coluna esquerda)**: Ação minha, Atribuídas, Acompanho, Delegadas (mantém).

**Chips de origem visíveis**:
- Projetos
- Processos
- Motor Artes
- China
- Aprovações
- Composição
- Embalagens
- Amostras

**KPIs no topo** (tela cheia `/projetos/central?tab=inbox`):
- Não lidas
- Aprovações pendentes
- Etapas em risco (com SLA estourado)
- Hoje

**Header**: badge "PMO Produto" ao lado de "unificada".

---

## Visão 2 — Genéricos (operacional)

Para quem só tem projetos sem vínculo a produto (todos `generico`). É o usuário "tarefas/equipe".

**Caixas (coluna esquerda)**: Ação minha, Atribuídas, Acompanho, Delegadas (mantém).

**Chips de origem visíveis**:
- Projetos
- Aprovações (apenas se a permissão `projetos_aprovacoes_central` estiver liberada — coerente com o guard recém-adicionado)

Os chips de Processos / Motor Artes / China / Composição / Embalagens / Amostras **não aparecem** porque nunca terão itens para esse perfil, e poluem a UI.

**KPIs no topo**:
- Não lidas
- Menções
- Favoritas
- Hoje

**Header**: badge "Equipe" ao lado de "unificada".

---

## Visão híbrida (admin / gerente geral)

Quando o usuário é Admin ou Gerente Geral de Projetos, mantém **todos os chips** (Visão 1) e ganha um **toggle no header** "Produto / Genéricos / Tudo" para alternar manualmente. Default = Tudo.

---

## Detecção da visão (frontend, sem migração)

Novo hook `useInboxScope()` que devolve `"produto" | "generico" | "hibrido"`:

1. Se `isAdmin || isGerenteGeralProjetos` → `hibrido`.
2. Lê os projetos do usuário via `useProjetos()` (hook já existente, já filtra por acesso).
3. Se algum projeto tem `vinculado_produto IS NOT NULL` ou `template <> 'generico'` → `produto`.
4. Caso contrário → `generico`.

Resultado é memorizado por sessão.

---

## Mudanças de código (apenas UI)

**`src/hooks/useInboxScope.ts`** *(novo)* — lógica acima.

**`src/components/inbox/InboxDrawer.tsx`**:
- Importa `useInboxScope`.
- Constrói `ORIGENS_VISIVEIS` filtrando `ORIGEM_META` conforme o escopo + permissão de aprovações.
- Header: badge dinâmica (`PMO Produto` / `Equipe` / `Tudo`).
- Toggle de escopo só renderiza no modo `hibrido`.

**`src/components/projetos/central/ProjetoInboxContent.tsx`**:
- Mesma lógica de escopo aplicada aos KPIs (troca `Menções/Favoritas` por `Aprovações pendentes/Etapas em risco` na visão Produto).
- `TIPO_FILTERS` ganha 2 itens extras (`aprovacao`, `etapa_atrasada`) só quando escopo = `produto`.

**`src/contexts/InboxDrawerContext.tsx`**: sem mudanças.

Nenhuma alteração em RLS, edge functions ou tabelas.

---

## Layout (referência)

```text
┌─ Caixa de Entrada  [PMO Produto] ────────────────┐
│ Ação minha (12)        Buscar… [ Não lidas ]     │
│ Atribuídas  (3)        ─────────────────────     │
│ Acompanho   (8)        ▣ Projetos                │
│ Delegadas   (1)        ▣ Aprovações  (visão      │
│                        ▣ Processos    Produto:   │
│ ORIGENS                ▣ Motor Artes  todos os   │
│ [Todas][Projetos]…     ▣ China        chips)     │
└──────────────────────────────────────────────────┘
```

Visão Genéricos: a coluna direita mostra apenas `Projetos` (e `Aprovações` se permitido).

---

## Fora do escopo

- Não muda quem **recebe** itens na inbox (continua sendo o backend / triggers existentes).
- Não cria novas permissões nem telas.
- Não altera o drawer de China nem hooks de origem.

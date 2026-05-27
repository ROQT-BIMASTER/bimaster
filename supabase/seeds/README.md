# supabase/seeds/

Seeds históricos de dados — **não são migrations**.

## O que vive aqui

Arquivos com DML (`INSERT`, `UPDATE`, `DELETE`) que populam dados de negócio:
catálogos, templates, fixtures de projetos demo. Os três arquivos atuais já
foram aplicados em produção (registrados em `supabase_migrations.schema_migrations`)
e estão preservados aqui apenas como referência para reconstrução de ambientes
novos / clones de desenvolvimento.

## O que NÃO vive aqui

DDL (CREATE/ALTER TABLE, RLS, GRANTs, functions, triggers, RPCs, índices) →
`supabase/migrations/`.

## Política

- **Migrations** (`supabase/migrations/`) são executadas em ordem, uma única
  vez, pelo harness Lovable. `DELETE`/`TRUNCATE`/`UPDATE` em massa dentro de
  uma migration, se reexecutados em outro ambiente ou após restore, destroem
  dados reais.
- **Seeds** (`supabase/seeds/`) **nunca** são executados automaticamente.
  Para rodar manualmente em um clone novo:

  ```bash
  psql "$DATABASE_URL" -f supabase/seeds/<arquivo>.sql
  ```

- Antes de abrir PR com mudanças em `supabase/migrations/`, conferir:

  ```bash
  rg -n '^(DELETE|TRUNCATE|UPDATE)\s' supabase/migrations/
  ```

  Qualquer match precisa ser convertido em seed ou justificado em revisão
  (ex.: `UPDATE` de coluna recém-criada com default — aceitável).

## Arquivos atuais

| Arquivo | Conteúdo |
|---|---|
| `20260304225927_projeto_tarefas_ruby_rose.sql` | DELETE + INSERT de ~300 tarefas do projeto Ruby Rose (UUID `b176ab9c-…`). |
| `20260521010655_pr2_briefings_v2.sql` | Seed Briefings v2 Ruby Rose (PR2). |
| `20260521022718_pr3_templates_8_tipos.sql` | 8 templates canônicos em `briefing_templates` (PR3). |

# Plano: remover `.env` do versionamento

## Diagnóstico

Estado atual auditado:

- `.env` versionado contém **apenas** chaves publishable / URL pública:
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (duplicatas sem prefixo `VITE_`)
- **Nenhum** secret de service-role, API key privada ou token está no `.env`. Esses ficam em Lovable Cloud Secrets (`Deno.env.get` nas edge functions).
- `.gitignore` atual ignora `*.local` mas **não** `.env`.
- **Zero** workflows CI consomem `.env` do repo (`.github/workflows/regression-greps.yml`, `security-rls-e2e.yml`, `netlify.toml`, `vercel.json`, `cloudflare/wrangler.toml` não referenciam).
- `.env.example` já existe e documenta o formato.
- Lovable Cloud **regera `.env` automaticamente** em cada sandbox. Removê-lo do tracking não quebra o agent Lovable.

## Avaliação de risco


| Risco                                   | Severidade real                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Vazamento de service-role               | **Nenhum** — não está no `.env`                                                                               |
| Vazamento de URL/publishable            | **Baixo** — chaves publishable são desenhadas para vir no bundle JS do browser; já estão expostas em produção |
| Repo virar público / colaborador errado | Mantém-se baixo (publishable), mas higiene de repo recomenda ignorar                                          |
| Rotação de chaves                       | **Desnecessária agora** — não há secret real exposto                                                          |


Conclusão: trata-se de **higiene**, não de incidente. Não é preciso rotacionar chaves nem disparar `supabase--rotate_api_keys`.

## Mudanças propostas

### 1. Atualizar `.gitignore`

Adicionar bloco no final, ignorando `.env` mas mantendo `.env.example`:

```text
# Lovable Cloud auto-generated (recreated per sandbox/clone)
.env
.env.*.local
!.env.example
```

### 2. Reforçar `.env.example`

Já bem documentado — adicionar uma linha curta avisando que o `.env` real é auto-provisionado pelo Lovable (sem mudança estrutural).

### 3. Documentar bootstrap para devs externos

Adicionar seção curta em `docs/onboarding/01-STACK-AND-SETUP.md` (e nota cruzada em `AGENTS.md` §5) explicando que, ao clonar fora do Lovable:

- O `.env` **não vem** no clone.
- Copiar de `.env.example` e preencher com valores do projeto Lovable Cloud (Connectors → Lovable Cloud → exibe URL + publishable key).
- Em ambiente Lovable, o `.env` é regenerado automaticamente — não precisa fazer nada.

### 4. Atualizar memória do projeto

Atualizar `mem://reference/onboarding-docs` mencionando que `.env` agora é gitignored e o caminho de bootstrap canônico.

## O que **não** muda

- `src/integrations/supabase/client.ts` — continua intocado (auto-gerado).
- `.env` no sandbox Lovable — continua existindo, regenerado.
- Edge Function secrets (Lovable Cloud Secrets) — não afetados, nunca estiveram no `.env`.
- CI — nenhum workflow precisa de ajuste.
- Não há rotação de chaves Supabase.

## Ação manual fora deste agent (obrigatória — agent Lovable não pode rodar `git`)

Após o merge desta mudança, **um humano** precisa rodar localmente (ou um colaborador via PR separado fora do Lovable):

```bash
git rm --cached .env
git commit -m "chore: untrack .env (now gitignored)"
git push
```

Sem isso, o arquivo continua no histórico/HEAD do repo. O `.gitignore` sozinho não remove arquivos já trackeados.

> **Nota sobre histórico**: o `.env` permanecerá em commits anteriores. Como não contém secrets reais (só publishable), **não recomendamos** reescrita de histórico (`git filter-repo` / BFG) — o custo (rebase forçado para todos os colaboradores, quebra de PRs abertos) supera o benefício.

## Bump de versão

`APP_VERSION` 3.4.76 → 3.4.77 + entrada no changelog (`src/components/erp/ApiDocumentation.tsx`) descrevendo a mudança de higiene de repo, conforme `mem://process/release-changelog-discipline`.

## Arquivos tocados

- `.gitignore` (editar)
- `.env.example` (ajuste mínimo de comentário)
- `docs/onboarding/01-STACK-AND-SETUP.md` (seção bootstrap)
- `AGENTS.md` (referência cruzada na §5)
- `mem://reference/onboarding-docs` (atualizar)
- `src/lib/version.ts` (bump)
- `src/components/erp/ApiDocumentation.tsx` (changelog)

## Confirmação solicitada

Antes de implementar, confirme:

1. **OK seguir sem rotacionar chaves Supabase** (são publishable, não há service-role no `.env`)?
2. **OK que o `git rm --cached .env` será feito fora do Lovable** (por você ou outro dev), já que o agent Lovable não roda comandos git?
3. **OK não reescrever histórico** do repo (manter `.env` em commits antigos, dado que são chaves publishable)?
## Triagem dos 3 findings

### M1 — Funções SQL sem `SET search_path` ✅ FALSO POSITIVO

Query no catálogo Postgres (`pg_proc` filtrando funções em `public` sem `proconfig` contendo `search_path=`):

```
=== Total ===
0
```

Todas as funções no schema `public` já têm `search_path` setado (provavelmente saneadas em migrations posteriores às de Set–Out 2025). **Nada a fazer**. Vou só registrar o resultado da auditoria no doc de segurança.

### M2 — `dangerouslySetInnerHTML` ✅ AMBOS SEGUROS

| Arquivo | Conteúdo | Risco real |
|---|---|---|
| `src/components/ui/chart.tsx:70` | `<style>` gerado a partir de `ChartConfig` (objeto interno do dev, nunca input de usuário) — padrão shadcn/ui oficial | Nenhum |
| `src/components/whatsapp/WhatsAppAgentFlow.tsx:14` | String literal estática com diagrama Mermaid (`<lov-mermaid>...</lov-mermaid>`) — zero variável interpolada | Nenhum |

**Mitigação proposta**: converter `WhatsAppAgentFlow.tsx` para JSX children comum (eliminar o atributo) — assim o scanner para de levantar e fica claro que não há injeção possível. `chart.tsx` é vendor (shadcn) — manter como está, adicionar comentário `// SAFE: ChartConfig is dev-defined, not user input` e deixar registrado no `@security-memory`.

### M3 — `package-lock.json` versionado num projeto Bun ✅ DELETAR

Confirmado: existem `bun.lockb` (197K) E `package-lock.json` (587K) no root. AGENTS.md §1 declara Bun como gestor oficial.

**Ação**: `rm package-lock.json` e adicionar ao `.gitignore` para garantir que ninguém versione novamente.

## Plano de execução

1. **Deletar** `package-lock.json`. Adicionar `package-lock.json` e `yarn.lock` ao `.gitignore`.
2. **Refatorar** `src/components/whatsapp/WhatsAppAgentFlow.tsx`: substituir `dangerouslySetInnerHTML` por `<lov-mermaid>{`...`}</lov-mermaid>` (children string).
3. **Anotar** `src/components/ui/chart.tsx`: comentário sobre origem segura (sem alterar código vendor).
4. **Documentar** em `docs/SECURITY-CORS-LOCKDOWN.md` (ou novo `docs/SECURITY-FINDINGS-M-SERIES.md`) o resultado da triagem M1/M2/M3.
5. **Atualizar** `@security-memory` instruindo o scanner a não re-levantar:
   - M1: todas as funções `public` já têm `search_path` setado (verificável por query em `pg_proc.proconfig`).
   - M2 chart.tsx: vendor shadcn, `ChartConfig` nunca recebe input de usuário.

## Arquivos a alterar

- `package-lock.json` (delete)
- `.gitignore` (append)
- `src/components/whatsapp/WhatsAppAgentFlow.tsx` (refactor)
- `src/components/ui/chart.tsx` (comentário 1 linha)
- `docs/SECURITY-FINDINGS-M-SERIES.md` (new)
- `@security-memory` (update via tool)

## Fora de escopo

- Não toco em A2 (`secureHandler`) nem A3 (`console.*`) — esperam sua sinalização.



# Ambiente Sandbox — Implementado (v1.8.0)

## Resultado

Toggle **Produção / Sandbox** adicionado ao API Tester, permitindo testar chamadas contra um ambiente simulado sem afetar dados reais.

## Componentes Implementados

| Componente | Arquivo | Status |
|---|---|---|
| Edge Function `api-sandbox` | `supabase/functions/api-sandbox/index.ts` | ✅ |
| Tabela `sandbox_requests` + RLS | Migração SQL | ✅ |
| Toggle Sandbox no ApiTester | `src/components/erp/ApiTester.tsx` | ✅ |
| Banner informativo na Documentação | `src/components/erp/ApiDocumentation.tsx` | ✅ |
| Changelog v1.8.0 | `src/components/erp/ApiDocumentation.tsx` | ✅ |

## Como Funciona

1. **Modo Produção** (padrão): Comportamento inalterado — fetch direto às APIs reais
2. **Modo Sandbox**: Chamadas roteadas via `supabase.functions.invoke("api-sandbox")` que:
   - Valida JWT do usuário logado
   - Simula respostas realistas baseadas no tipo de operação (CRUD, sync, pagamento)
   - NÃO grava dados no banco de produção
   - Registra toda chamada na tabela `sandbox_requests` para auditoria
   - Marca respostas com `sandbox: true, dry_run: true`

## Indicadores Visuais

- Badge laranja "SANDBOX" animado no header do ApiTester
- Botão "Dry Run" (laranja) em vez de "Enviar"
- Borda laranja na área de resposta
- Histórico prefixado com `[SANDBOX]`
- Banner informativo na documentação com ícone FlaskConical

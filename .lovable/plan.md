

# Atualizar Documentação — Domínio bimaster.online

## Contexto

A documentação do Portal ERP exibe URLs com `bimaster.lovable.app` e `SEU_PROJETO.supabase.co`. O objetivo é trocar todas as referências visíveis para `bimaster.online`, mantendo o funcionamento real (backend cloud) inalterado.

## Alterações

### 1. `src/components/erp/ApiDocumentation.tsx`

- **Linha 962**: Trocar `https://bimaster.lovable.app/dashboard/integracao-erp` → `https://bimaster.online/dashboard/integracao-erp`
- **Linha 964 (servers)**: Adicionar server de documentação com domínio próprio:
  ```
  servers: [
    { url: "https://api.bimaster.online/v1", description: "Produção" },
    { url: BASE_URL, description: "Produção (direto)" }
  ]
  ```
  Ou manter apenas a URL com domínio próprio se preferir ocultar completamente o backend.

### 2. `src/components/erp/SdkDownloadButtons.tsx`

- **Linha 5**: Trocar `YOUR_SUPABASE_URL/functions/v1` → `https://api.bimaster.online/v1`
- **Linhas 292, 369, 505, 682**: Trocar `https://SEU_PROJETO.supabase.co/functions/v1` → `https://api.bimaster.online/v1` em todos os exemplos de uso dos SDKs (TypeScript, JavaScript e Python)

### Resumo

| Arquivo | Mudança |
|---|---|
| `ApiDocumentation.tsx` | URL de contato e server OpenAPI → bimaster.online |
| `SdkDownloadButtons.tsx` | Todos os exemplos de uso dos SDKs → api.bimaster.online |

Total: ~10 substituições de string em 2 arquivos. Nenhuma mudança funcional.


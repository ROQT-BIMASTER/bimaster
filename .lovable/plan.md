
# Fornecedores — Menu, Validação ERP e Visibilidade por Empresa — Concluído

## O que foi feito

### 1. Rota realocada para módulo Financeiro
- Rota principal: `/dashboard/financeiro/fornecedores` (screenCode: `financeiro_fornecedores`)
- Redirect de compatibilidade: `/dashboard/fornecedores` → `/dashboard/financeiro/fornecedores`

### 2. Edge function `erp-fornecedores-sync`
- `POST /check` — verifica CNPJ no ERP via `erp_config`, retorna `erp_code` se existir
- `POST /sync` — cadastra fornecedor no ERP, persiste `erp_code` e `erp_synced_at`
- Fallback gracioso quando ERP não configurado (salva apenas local)
- Logs em `erp_sync_log` para auditoria

### 3. Integração ERP no fluxo de cadastro
- Após salvar novo fornecedor, chama `/check` → `/sync` automaticamente
- Botão de sync manual (ícone RefreshCw) para fornecedores sem `erp_code`
- Toasts informativos em cada etapa (encontrado, cadastrado, falha)

### 4. Filtro por empresa do usuário
- Integração com `useEmpresaFilter` — mostra apenas fornecedores das empresas do usuário
- Select de empresa no filtro e formulário lista apenas empresas visíveis
- `empresa_id` obrigatório no cadastro (auto-preenchido se usuário tem 1 empresa)

### 5. Configuração de visibilidade
- Tabela `config_fornecedor_visibilidade` (empresa_id, módulo, visibilidade: propria/grupo/todas)
- RLS: leitura para autenticados, gestão para admins
- Página `/dashboard/configuracoes/fornecedores-visibilidade` para admins

### Arquivos criados/modificados
- `supabase/functions/erp-fornecedores-sync/index.ts` — novo
- `src/pages/ConfigFornecedorVisibilidade.tsx` — novo
- `src/pages/Fornecedores.tsx` — refatorado (empresa context, ERP sync, empresa obrigatória)
- `src/App.tsx` — rotas atualizadas

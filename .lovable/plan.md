

# Fornecedores — Menu, Validação ERP e Visibilidade por Empresa

## Situação Atual

- A página `/dashboard/fornecedores` (screenCode: `financeiro_fornecedores`) está numa rota "solta", fora do agrupamento do módulo financeiro
- Não há validação contra o ERP ao cadastrar fornecedores — o `saveMutation` insere direto em `fornecedores` sem verificar se o CNPJ já existe no ERP Huggs
- O filtro de empresa na tela usa `empresas` direto (todas), sem respeitar a visibilidade configurada do usuário via `useEmpresaContext`
- Não existe configuração de limitação de visibilidade de fornecedores por empresa/perfil

## Plano

### 1. Realocar rota para dentro do módulo Financeiro

Mover a rota de `/dashboard/fornecedores` para `/dashboard/financeiro/fornecedores` com screenCode `financeiro_fornecedores` (mantém rota antiga como redirect para compatibilidade).

No sidebar, o item "Fornecedores" ficará sob **Financeiro → Cadastros** junto com Empresas, Portadores e Centros de Custo.

### 2. Criar edge function `erp-fornecedores-sync` — Validação bidirecional com ERP

Nova edge function que, ao cadastrar um fornecedor:

1. Recebe CNPJ + dados do fornecedor
2. Consulta a API Huggs para verificar se o fornecedor já existe no ERP
3. **Se existir**: retorna o `codigo_fornecedor` do ERP e dados atualizados
4. **Se não existir**: envia o cadastro ao ERP, recebe o código gerado
5. Persiste o `erp_code` e `erp_synced_at` na tabela `fornecedores`

Rotas:
- `POST /check` — verifica CNPJ no ERP, retorna código se existir
- `POST /sync` — cadastra no ERP se não existe, ou atualiza se existe, retorna código

### 3. Integrar validação ERP no fluxo de cadastro da página

No `handleSave` da página `Fornecedores.tsx`:
1. Após validar CNPJ e verificar duplicidade local, chamar `erp-fornecedores-sync/check`
2. Se o ERP retornar código existente, preencher automaticamente `erp_code` e exibir toast informativo
3. Se não existir, após salvar localmente, chamar `erp-fornecedores-sync/sync` para cadastrar no ERP
4. Salvar o `erp_code` retornado na tabela `fornecedores`
5. Exibir badge "ERP: XXXX" no painel de detalhes (já existe)

### 4. Filtrar fornecedores por empresa do usuário (visibilidade)

Integrar `useEmpresaContext` na página `Fornecedores.tsx`:
- Filtrar a query por `empresaIds` do contexto (empresas que o usuário tem acesso)
- O filtro "Todas Empresas" mostra apenas empresas do contexto do usuário (não todas do sistema)
- Admins continuam vendo tudo

### 5. Configuração de visibilidade de fornecedores por empresa

Criar tabela `config_fornecedor_visibilidade`:

```text
empresa_id (int, FK empresas)
modulo (text: 'contas_pagar', 'trade', 'eventos')
visibilidade (text: 'propria', 'grupo', 'todas')
```

- `propria`: só vê fornecedores da sua empresa
- `grupo`: vê fornecedores de empresas do mesmo grupo
- `todas`: vê todos os fornecedores (comportamento atual)

Tela de configuração acessível em **Configurações → Fornecedores** para admins definirem a regra por empresa.

### 6. Coluna `empresa_id` obrigatória no cadastro

No formulário de novo fornecedor, tornar a seleção de empresa obrigatória. Se o usuário tiver apenas uma empresa, preencher automaticamente. Ao salvar, o fornecedor fica vinculado à empresa selecionada — isso é a base para a visibilidade funcionar.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar `config_fornecedor_visibilidade` com dados iniciais |
| `supabase/functions/erp-fornecedores-sync/index.ts` | **Criar** — validação e sync com ERP Huggs |
| `src/pages/Fornecedores.tsx` | Integrar `useEmpresaContext`, validação ERP no save, empresa obrigatória |
| `src/App.tsx` | Mover rota para `/dashboard/financeiro/fornecedores`, manter redirect |
| `src/pages/ConfigFornecedorVisibilidade.tsx` | **Criar** — tela admin para configurar visibilidade por empresa |

## Fluxo de Cadastro Atualizado

```text
Usuário preenche CNPJ
    ↓
CnpjSearchButton → Receita Federal (auto-preenche dados)
    ↓
Clica "Salvar"
    ↓
Valida CNPJ localmente → Verifica duplicidade local
    ↓
Chama erp-fornecedores-sync/check (CNPJ no ERP?)
    ├─ SIM → Retorna erp_code, atualiza dados se necessário
    └─ NÃO → Salva local → Chama erp-fornecedores-sync/sync
              → ERP cadastra e retorna código
              → Persiste erp_code no fornecedores
    ↓
Fornecedor salvo com erp_code + empresa_id
```


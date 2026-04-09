

# Atualização do Frontend — Alinhamento com Backend

## Contexto

Nas últimas fases, adicionamos ~20 colunas ao banco (empresas, clientes, departamentos, plano_contas, contas_pagar), expandimos a empresas-api para CRUD completo, endurecemos schemas Zod e corrigimos 4 RLS policies. O frontend ainda não reflete essas mudanças.

## Escopo — Apenas o que precisa mudar (sem quebrar produção)

### 1. GerenciamentoDepartamentos — Novos campos `empresa_id` e `codigo_integracao`

**Arquivo:** `src/components/configuracoes/GerenciamentoDepartamentos.tsx`

- Adicionar campos `empresa_id` (Select de empresas) e `codigo_integracao` (Input texto) ao formulário de criar/editar
- Atualizar a interface `Departamento` com os novos campos
- Incluir `empresa_id` e `codigo_integracao` no insert/update do Supabase
- Mostrar colunas "Empresa" e "Cód. Integração" na tabela de listagem
- Buscar empresas ativas para popular o Select

### 2. PlanoContas — Novos campos `tipo_categoria`, `is_active`, `natureza`

**Arquivo:** `src/pages/PlanoContas.tsx`

- Atualizar a interface `Account` para incluir `tipo_categoria`, `is_active` e `natureza` (campos já parcialmente mapeados — `natureza` e `is_active` já existem na interface)
- Adicionar exibição de `tipo_categoria` (badge "Receita"/"Despesa") nas linhas da árvore
- O campo `is_active` já é usado como `is_active` na interface existente — garantir que filtra corretamente

**Arquivo:** `src/components/configuracoes/NovaContaDialog.tsx` e `EditarContaDialog.tsx`

- Adicionar campo `tipo_categoria` (Select: "Receita"/"Despesa") aos dialogs de criação e edição

### 3. ApiDocumentation — Empresas CRUD expandido

**Arquivo:** `src/components/erp/ApiDocumentation.tsx`

- Atualizar `empresasCrud` para incluir os novos endpoints `/incluir` e `/alterar` com os campos novos (`regime_apuracao`, `tipo_empresa`, `natureza_juridica`, `porte`, `capital_social`, `data_abertura`, `codigo_ibge_municipio`, `responsavel_nome`, `responsavel_cpf`)
- Atualizar o response de `/consultar` para mostrar os novos campos
- Renomear section de "Consulta & Listagem" para "CRUD Completo"

### 4. ApiTester — Presets para novos endpoints de Empresas

**Arquivo:** `src/components/erp/ApiTester.tsx`

- Adicionar presets para `/empresas-api/incluir` e `/empresas-api/alterar` no objeto `PRESET_PAYLOADS`

### 5. SdkDownloadButtons — Interfaces para Empresas

**Arquivo:** `src/components/erp/SdkDownloadButtons.tsx`

- Adicionar interfaces `EmpresaIncluirPayload` e `EmpresaAlterarPayload` com todos os novos campos
- Adicionar métodos `empresasIncluir()`, `empresasAlterar()` à classe do SDK

### 6. RelatorioSeguranca — Referenciar `stores_safe_v2`

**Arquivo:** `src/pages/RelatorioSeguranca.tsx`

- Atualizar referência de `stores_safe` para `stores_safe_v2` na documentação de segurança

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/components/configuracoes/GerenciamentoDepartamentos.tsx` | Campos empresa_id e codigo_integracao |
| `src/pages/PlanoContas.tsx` | Badge tipo_categoria na árvore |
| `src/components/configuracoes/NovaContaDialog.tsx` | Campo tipo_categoria no form |
| `src/components/configuracoes/EditarContaDialog.tsx` | Campo tipo_categoria no form |
| `src/components/erp/ApiDocumentation.tsx` | Endpoints incluir/alterar empresas |
| `src/components/erp/ApiTester.tsx` | Presets empresas incluir/alterar |
| `src/components/erp/SdkDownloadButtons.tsx` | Interfaces Empresa no SDK |
| `src/pages/RelatorioSeguranca.tsx` | stores_safe → stores_safe_v2 |

## Garantia de não-quebra

- Todos os novos campos são **opcionais** (nullable no banco com defaults)
- Nenhuma query existente é removida ou alterada na estrutura
- Componentes existentes continuam funcionando — apenas adições de campos nos forms e tabelas




## Diagnóstico e Plano

### Problema 1: Matérias-primas não carregam na tabela

A consulta ao banco confirma que existem 2 registros com `ativo: false`. A tabela aparece vazia porque a policy RLS `fmp_select` exige `check_user_access(auth.uid(), 'fabrica')`, que verifica o módulo `fabrica` — diferente da permissão de tela `fabrica_mps` que libera o acesso à página. Para usuários do departamento "Compras e Faturamento", a tela aparece mas o SELECT retorna vazio.

**Correção:** Atualizar a policy `fmp_select` para também aceitar o módulo/tela `fabrica_mps`, ou criar uma função auxiliar que cubra ambos os cenários. A abordagem mais simples é alterar a policy para usar uma verificação que inclua a permissão de tela `fabrica_mps`.

Adicionalmente, o `NovoMateriaPrimaDialog` insere `status: "ativo"` ao invés de `"disponivel"`, causando inconsistência com os labels da tabela (`disponivel`, `quarentena`, `bloqueado`). Isso será corrigido.

### Problema 2: Associação de XML à Matéria-Prima (novo recurso)

Adicionar ao cadastro/edição de matéria-prima a opção de vincular um XML de NF-e (igual ao fluxo de insumos na Ficha de Custo), permitindo:
- Importar dados do fornecedor, custo unitário e dados fiscais (NCM/CFOP) automaticamente do XML
- Reutilizar XMLs já salvos no banco
- Atualizar o custo e fornecedor da matéria-prima com base na NF-e selecionada

**Implementação:**
1. Na tela de listagem (`FabricaMateriasPrimas.tsx`), adicionar um botão "Vincular XML" nas ações de cada matéria-prima
2. Reutilizar o componente `VincularXmlInsumoDialog` existente, passando o `mpId` da matéria-prima
3. No callback `onVincular`, atualizar o `custo_unitario`, `fornecedor_id` (ou campo de referência) e dados fiscais da matéria-prima diretamente no banco
4. Corrigir a policy RLS para garantir que usuários com permissão `fabrica_mps` consigam ler/editar

### Arquivos a modificar
- **Migration SQL**: Atualizar policy `fmp_select` para incluir verificação de `fabrica_mps`
- **`src/pages/FabricaMateriasPrimas.tsx`**: Adicionar botão "Vincular XML" e integrar `VincularXmlInsumoDialog`
- **`src/components/fabrica/NovoMateriaPrimaDialog.tsx`**: Corrigir `status: "ativo"` para `status: "disponivel"`

### Detalhes técnicos
- A policy RLS será alterada via `DROP POLICY` + `CREATE POLICY` usando `check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps')` (ou equivalente existente)
- O `VincularXmlInsumoDialog` já aceita `mpId` e salva NCM/CFOP na matéria-prima — basta integrá-lo na listagem
- O callback atualizará `custo_unitario` e `fornecedor_id` via update no banco


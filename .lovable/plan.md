

# Plano: Tipos de Documento Dinâmicos com Vínculo a Módulo/Projeto

## Problema
Os tipos de documento (Embalagem, Rótulo, Arte, etc.) estão hardcoded em dois lugares (`JuntadasSection.tsx` e `ConfigDocWorkflows.tsx`). O usuário quer:
1. Criar tipos de documento customizados
2. Vincular tipos a módulos e projetos
3. Quando criados na China (checklist custom), aparecer automaticamente como opção no fluxo de processos

## Solução

### 1. Tabela `process_tipos_documento`
Nova tabela para tipos de documento dinâmicos:
- `id`, `valor` (slug único), `label`, `modulo` (opcional — vincular a módulo específico), `projeto_id` (opcional — vincular a projeto), `origem` (manual / china_checklist), `ativo`, `created_by`, `created_at`
- Seed com os 6 tipos atuais hardcoded (embalagem, rotulo, arte, ficha_tecnica, regulatorio, outro)

### 2. Hook `useProcessTiposDocumento`
- Query para listar tipos ativos (filtráveis por módulo/projeto)
- Mutation para criar novo tipo
- Mutation para desativar tipo

### 3. UI — Criar Tipo de Documento no Dialog de Juntada
- Substituir o `<Select>` hardcoded de `TIPOS_DOCUMENTO` por um select dinâmico + botão "+" para criar novo tipo inline
- Ao criar, o dialog pede: label, módulo de destino (opcional), projeto vinculado (opcional)
- Mesma lógica aplicada na página `ConfigDocWorkflows.tsx`

### 4. Sincronização com China
- Quando um custom item é criado na China (`china_checklist_custom_itens`), inserir automaticamente um registro na `process_tipos_documento` com `origem = 'china_checklist'`
- Isso pode ser feito via trigger no banco ou no código do `ChinaChecklistFocusMode` ao salvar o item custom

### 5. Atualizar componentes consumidores
- `JuntadasSection.tsx`: usar hook dinâmico no lugar da constante `TIPOS_DOCUMENTO`
- `ConfigDocWorkflows.tsx`: usar hook dinâmico no lugar da constante `TIPOS_DOCUMENTO`

### Arquivos
- **Criar**: migration SQL (tabela + seed + trigger), `src/hooks/useProcessTiposDocumento.ts`
- **Editar**: `src/components/processo/JuntadasSection.tsx`, `src/pages/ConfigDocWorkflows.tsx`, `src/components/china/ChinaChecklistFocusMode.tsx` (inserir tipo ao criar custom item)


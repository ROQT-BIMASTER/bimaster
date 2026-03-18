

# Plano: Despacho de Documentos na Consulta de Processos

## Problema
A funcionalidade de "Despachar para Módulo" existe apenas na Pasta Digital da China. O usuário quer que essa capacidade esteja disponível na tela de Consulta de Processos, permitindo que qualquer módulo que receba ou crie um documento possa despachá-lo para outro módulo.

## Solução

### 1. Adicionar botão "Despachar" nas Juntadas
Na seção `JuntadasSection`, cada documento juntado terá um botão de despacho. Ao clicar, abre um dialog similar ao `DespachoModuloDialog` da China, permitindo selecionar módulo de destino e descrição.

### 2. Criar componente genérico `DespachoDialog`
Extrair a lógica de despacho do componente China-específico para um componente reutilizável em `src/components/processo/DespachoDialog.tsx`:
- Lista unificada de módulos de destino (Composição INCI, Regulatório, Qualidade, Motor de Artes, Embalagem, Cadastro, Logística)
- Registra o despacho como evento no `process_events` e atualiza a juntada

### 3. Adicionar campos de despacho na tabela `process_juntadas`
Migração para adicionar:
- `despacho_modulo` (text, nullable)
- `despacho_descricao` (text, nullable)
- `despacho_data` (timestamptz, nullable)
- `despacho_por` (uuid, nullable)

### 4. Atualizar `useProcessJuntadas` com mutation de despacho
Nova mutation `despacharJuntada` que atualiza os campos de despacho e registra um `process_event`.

### 5. UI na lista de juntadas
- Badge mostrando módulo de destino quando despachado
- Botão "Despachar" no card de cada juntada e no drawer de detalhe
- Indicação visual de documentos recebidos por despacho vs criados localmente

### Arquivos
- **Criar**: `src/components/processo/DespachoDialog.tsx`, migration SQL
- **Editar**: `src/components/processo/JuntadasSection.tsx` (botão + badge de despacho), `src/hooks/useProcessJuntadas.ts` (mutation despacho)


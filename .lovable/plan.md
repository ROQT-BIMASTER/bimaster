

# Salvar Anexo do Chat no Cofre com Categorização Expandida

## Contexto
Atualmente, o usuário só pode enviar documentos para o cofre **no momento do envio** (checkbox "Vincular ao Cofre"). A solicitação pede que o usuário possa selecionar **um anexo já enviado no chat** e enviá-lo para o cofre depois, com categorização obrigatória e vinculação a matéria-prima quando aplicável.

## Alterações

### 1. Expandir categorias de documentos
Atualizar `CATEGORIAS` em `DocumentosTab.tsx` e em todos os locais relevantes:
- **orcamento** (Orçamento)
- **nf** (Nota Fiscal)
- **art** (ART)
- **embalagem_tampa** (Tampa)
- **embalagem_frasco** (Frasco)
- **embalagem_rotulo** (Rótulo)
- **embalagem_caixa** (Caixa)
- **materia_prima** (Matéria-Prima)
- **evidencia** (Evidência)
- **contrato** (Contrato)
- **geral** (Geral)

### 2. Criar dialog `EnviarParaCofreDialog.tsx`
Dialog modal que aparece ao clicar em um anexo do chat para enviá-lo ao cofre:
- Mostra nome do arquivo
- Select obrigatório de **categoria**
- Se categoria = `materia_prima`, exibe select obrigatório de matéria-prima (carregado de `fabrica_materias_primas` via fórmula do produto ou busca direta)
  - Se a MP não existir, botão "Cadastrar nova matéria-prima" (abre dialog inline ou redireciona)
- Se categoria = `embalagem_*`, opcionalmente vincular à MP do insumo correspondente
- Botão "Salvar no Cofre" que:
  1. Insere registro em `fabrica_revisao_documentos` com categoria e `materia_prima_id`
  2. Atualiza o anexo na mensagem original marcando `enviado_para_cofre: true`
  3. Toast de sucesso

### 3. Editar `RevisaoChatPanel.tsx`
- Em cada anexo do chat que **não** esteja marcado como `enviado_para_cofre`, adicionar um botão/ícone de "Enviar para o Cofre" (ícone Shield ou Lock)
- Ao clicar, abre `EnviarParaCofreDialog` passando: `anexo`, `revisaoId`, `produtoId`, `mensagemId`
- Após salvar, atualizar a mensagem localmente para refletir o badge "Cofre"

### 4. Atualizar `DocumentosTab.tsx`
- Expandir array `CATEGORIAS` com as novas categorias
- Adicionar ícones para as novas categorias (embalagem, art, materia_prima)
- Labels em português nos selects de filtro e categorização

### 5. Atualizar categorias no envio direto do chat
- Quando o checkbox "Vincular ao Cofre" está ativo no envio de anexo, mostrar o select de categoria obrigatório antes do envio
- Se categoria = `materia_prima`, obrigar vinculação à MP

## Arquivos
- **Criar**: `src/components/fabrica/EnviarParaCofreDialog.tsx`
- **Editar**: `src/components/fabrica/RevisaoChatPanel.tsx` (botão cofre nos anexos, integrar dialog)
- **Editar**: `src/components/fabrica/DocumentosTab.tsx` (expandir categorias e ícones)


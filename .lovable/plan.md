

# Atribuição em Massa de Municípios a Vendedor

## Objetivo

Adicionar um novo dialog na página de Municípios que permita selecionar um vendedor e colar/digitar uma lista de municípios em massa (um por linha) para atribuição rápida. Incluir também uma opção de sugestão por IA que distribui municípios sem vendedor automaticamente.

## Solução

### 1. Novo componente `AtribuirMunicipiosMassaDialog`

- Botão "Atribuir em Massa" ao lado dos botões existentes
- Dialog com:
  - **Select de Vendedor** (obrigatório)
  - **Textarea** para colar lista de municípios (um por linha, ex: "RECIFE", "OLINDA - PE")
  - **Botão "Processar Lista"**: faz matching fuzzy dos nomes digitados contra os municípios cadastrados na tabela `municipios`, exibindo preview com status (encontrado/não encontrado)
  - **Tabela de preview**: mostra cada linha digitada, o município encontrado (ou "Não encontrado"), e checkbox para confirmar
  - **Botão "Atribuir Selecionados"**: executa `UPDATE municipios SET vendedor_id = X WHERE id IN (...)`

### 2. Matching inteligente

- Normalizar texto (uppercase, remover acentos, trim)
- Buscar por `nome` exato ou parcial na tabela `municipios`
- Se o usuário digitar "RECIFE - PE", separar nome e UF para match mais preciso
- Exibir score de confiança visual (verde = match exato, amarelo = parcial)

### 3. Modo IA — Distribuição automática

- Botão secundário "Sugerir por IA" que:
  - Pega todos os municípios sem vendedor (`vendedor_id IS NULL`)
  - Analisa a distribuição geográfica (UF/região) dos municípios já atribuídos a cada vendedor
  - Sugere atribuição automática baseada em proximidade geográfica
  - Usa edge function existente com Lovable AI para gerar sugestões
  - Exibe preview antes de confirmar

### 4. Integração na página

- Adicionar o novo botão na barra de ações do `Municipios.tsx`
- Passar `onSuccess={fetchMunicipios}` para refresh após atribuição

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/admin/AtribuirMunicipiosMassaDialog.tsx` | Novo componente com textarea + matching + preview |
| `src/pages/Municipios.tsx` | Adicionar botão do novo dialog |
| `supabase/functions/sugerir-municipios-vendedor/index.ts` | Nova edge function para sugestão IA |


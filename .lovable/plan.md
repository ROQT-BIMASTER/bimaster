

# Plano: Página de Consulta de Movimentações do Processo

## Objetivo
Criar uma página dedicada estilo "consulta processual" (inspirada no e-SAJ) onde o usuário busca um produto e visualiza todas as movimentações do seu processo de ciclo de vida.

## Estrutura da Página

```text
┌──────────────────────────────────────────────────────────────┐
│  ← Voltar    Consulta de Processos de Produto               │
├──────────────────────────────────────────────────────────────┤
│  [Busca por nome/ref/número processo]  [Tipo ▼]  [Buscar]   │
├──────────────────────────────────────────────────────────────┤
│  Processo: PRD-2025-0042                                     │
│                                                              │
│  Tipo           Etapa Atual       Status         Criado em   │
│  China          Desenvolvimento   Em Andamento   12/01/25    │
├──────────────────────────────────────────────────────────────┤
│  ETAPAS DO CICLO DE VIDA                                     │
│  ✅ Ideia → ✅ Projeto → ✅ Pré-cadastro → 🔵 Desenv. → ... │
│                                                      ∨ Mais  │
├──────────────────────────────────────────────────────────────┤
│  MOVIMENTAÇÕES                                               │
│  Data           Movimento                                    │
│  ─────────────  ──────────────────────────────────────────── │
│  15/03/2026     Etapa avançada: Projeto → Pré-cadastro       │
│                 Usuário: Ricardo Flausino · Módulo: processo  │
│  14/03/2026     Documento aprovado: Laudo de Qualidade       │
│                 Usuário: Erika · Módulo: documentos           │
│  12/03/2026     Foto adicionada ao produto                   │
│                 Usuário: Ahmad · Módulo: china                │
│                                              ∨ Mais (50→100) │
├──────────────────────────────────────────────────────────────┤
│  HISTÓRICO DE ETAPAS                                         │
│  Etapa          Status      Início       Fim       Tempo     │
│  Ideia          Concluído   10/01/25     12/01/25  2 dias    │
│  Projeto        Concluído   12/01/25     20/01/25  8 dias    │
│  Pré-cadastro   Em Andamento 20/01/25    —         25 dias   │
└──────────────────────────────────────────────────────────────┘
```

## Implementação

### 1. Nova página `src/pages/ConsultaProcessos.tsx`
- Campo de busca textual (nome do produto, número do processo, referência)
- Filtro por tipo (China, Brasil, Fábrica)
- Ao selecionar um processo, exibe o painel completo com:
  - **Cabeçalho**: número do processo, tipo, status, etapa atual, data de criação
  - **Barra de etapas**: pills do ciclo de vida (reutilizando layout do `ProcessoResumo`)
  - **Movimentações**: tabela cronológica com data, descrição, usuário, módulo de origem (dados de `process_events` + `vw_process_timeline`)
  - **Histórico de Etapas**: tabela com tempo de permanência por etapa (dados de `process_step_history`)

### 2. Hook de busca
- Query em `product_process` com filtros por `numero_processo`, `produto_tipo`
- Lookup de nome do produto via join condicional (china_submissoes, projetos, etc.)

### 3. Rota
- `/dashboard/processos/consulta` protegida por `ProtectedRoute` (acessível a todos autenticados)
- Adicionar rota no `App.tsx`

### 4. Sidebar (opcional)
- Pode ser acessado via link direto ou de dentro da ficha do produto

### Arquivos
- **Criar**: `src/pages/ConsultaProcessos.tsx`
- **Editar**: `src/App.tsx` (nova rota)


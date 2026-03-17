

## Pasta Digital do Produto — Rastreamento Documental Estilo TJSP

### Conceito

Criar uma nova aba **"Pasta Digital"** no `ProdutoBrasilCadastro` inspirada no sistema de Pasta Digital do TJSP: uma árvore hierárquica de documentos à esquerda (organizada por fases/categorias) com visualizador de documentos à direita (split-pane). Cada fase pode ser direcionada a um departamento responsável que deve emitir parecer (aprovado/pendência/rejeitado).

Adicionalmente, reformular o visual do `ProjetoVincularChina` para seguir a identidade do checklist da China (sidebar de categorias + cards no estilo `ChinaChecklistFocusMode`).

### 1. Pasta Digital — Nova Aba no Produto Brasil

**Tabela `produto_brasil_pasta_digital`:**

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| produto_brasil_id | uuid FK | |
| fase | text | "documentos_diversos", "despacho", "certidao", "emenda", etc. |
| titulo | text | Nome do documento/peça |
| paginas | text | "1-14", "15", "17-18" (ref. visual) |
| arquivo_url | text nullable | URL do arquivo |
| arquivo_path | text nullable | Path no storage |
| ordem | integer | Posição na árvore |
| parent_id | uuid nullable self-ref | Para sub-agrupamentos |
| departamento_id | uuid nullable FK | Departamento responsável pelo parecer |
| parecer_status | text default 'pendente' | "pendente", "aprovado", "com_pendencia", "rejeitado" |
| parecer_por | uuid nullable | Quem emitiu parecer |
| parecer_data | timestamptz nullable | Quando |
| parecer_observacao | text nullable | Nota do parecer |
| created_by | uuid | Quem inseriu |
| created_at | timestamptz | |

RLS: authenticated SELECT/INSERT/UPDATE.

**Componente `PastaDigitalPanel.tsx`:**

```text
┌─────────────────────┬──────────────────────────────────────┐
│ 🗂 Pasta Digital     │  Visualizador de Documento           │
│                     │                                      │
│ ▼ Documentos Div.   │  ┌──────────────────────────────┐    │
│   □ Páginas 11-14   │  │                              │    │
│   □ Página 15       │  │    PDF / Imagem Preview      │    │
│   □ Página 16       │  │                              │    │
│ ▼ Despacho          │  │                              │    │
│   ■ Páginas 50-51 ← │  └──────────────────────────────┘    │
│ ▼ Certidão Pub.     │                                      │
│   □ Página 52       │  Parecer: [Depto Regulatório ▼]      │
│ ▼ Emenda à Inicial  │  Status: ● Aprovado  ○ Pendência     │
│   □ Páginas 55-56   │  Obs: [________________]             │
│                     │  [Emitir Parecer]                    │
│ [+ Adicionar Peça]  │                                      │
└─────────────────────┴──────────────────────────────────────┘
```

- Árvore colapsável com ícones por tipo de peça (Despacho, Certidão, Documento)
- Seleção ativa destaca o nó na árvore (fundo azul, como TJSP)
- Viewer à direita renderiza PDF inline (`<iframe>`) ou preview de imagem
- Abaixo do viewer: painel de parecer com seletor de departamento, status e observação
- Badge de status por nó na árvore (verde=aprovado, amarelo=pendência, vermelho=rejeitado)
- Contador de páginas no header: "Página X de Y"
- Botão "Adicionar Peça" com upload + categorização

### 2. Vincular China — Nova Identidade Visual

Reformular `ProjetoVincularChina.tsx` para seguir o padrão do `ChinaChecklistFocusMode`:

- **Painel esquerdo**: Sidebar vertical com categorias (China Envia / Brasil Envia) mostrando contadores por categoria, igual ao checklist
- **Painel central**: Cards de submissão no estilo dos document slots (com ícone, label bilíngue, badge de status, borda colorida por status)
- **Painel direito**: Projeto & Tarefas permanece, mas com visual mais limpo usando o mesmo estilo de cards
- Mesma paleta de cores: azul para China Envia, verde para Brasil Envia
- Separador visual `CHINA ENVIA 中国发送` / `BRASIL ENVIA 巴西发送` como no checklist

### 3. Direcionamento Departamental

Integrar o conceito de "parecer departamental" ao fluxo:

- Cada fase/documento na Pasta Digital pode ser atribuído a um departamento (Regulatório, Comercial, Qualidade, etc.)
- O departamento recebe a pendência no seu painel de tarefas
- O parecer fica registrado com nome, data e observação (audit trail)
- Na árvore, ícone de avatar do departamento responsável ao lado do nó
- Filtro "Minhas Pendências" para cada departamento ver apenas o que precisa analisar

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `produto_brasil_pasta_digital` + RLS |
| `src/components/produto-brasil/PastaDigitalPanel.tsx` | Novo — árvore + viewer + parecer |
| `src/pages/ProdutoBrasilCadastro.tsx` | Adicionar aba "Pasta Digital" |
| `src/pages/ProjetoVincularChina.tsx` | Reformular layout com identidade do checklist China |
| `src/hooks/usePastaDigital.ts` | Novo — CRUD + parecer hooks |


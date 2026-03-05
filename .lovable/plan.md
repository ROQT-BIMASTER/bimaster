

## Painel de Produto + Checklist de Lançamento

Remover o `max-w-3xl` da coluna esquerda e reorganizar em **sub-layout de 2 colunas**: conteúdo principal à esquerda + painel lateral fixo à direita (antes do chat).

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Header (status, estágio, código, título, sair do foco)                │
├────────────────────────────┬──────────────────┬────────────────────────┤
│  DETALHES DA TAREFA        │  PAINEL PRODUTO  │  💬 CHAT              │
│                            │                  │                        │
│  Campos (status, prazo..)  │  ┌────────────┐  │  mensagens...          │
│                            │  │   📷 Foto  │  │                        │
│  📊 Gráfico Evolução       │  │  HB-L6532  │  │                        │
│                            │  │  Marca/Linha│  │                        │
│  Marcos                    │  └────────────┘  │                        │
│  Descrição                 │                  │                        │
│  Subtarefas                │  ✅ CHECKLIST     │                        │
│                            │  ☑ Briefing      │                        │
│  📎 Documentos & Cofre     │  ☑ Arte Final    │                        │
│                            │  ☑ Ficha Técnica │                        │
│  💬 Comentários            │  ☐ Laudo         │                        │
│                            │  ☐ Certificado   │                        │
│                            │                  │                        │
│                            │  ── Progresso ── │                        │
│                            │  ████████░░ 60%  │                        │
└────────────────────────────┴──────────────────┴────────────────────────┘
```

### Mudanças

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Editar | `TarefaFocusMode.tsx` | Remover `max-w-3xl`. Reorganizar a coluna esquerda em flex com 2 sub-colunas: (1) conteúdo scrollável existente, (2) painel fixo de ~280px com card do produto e checklist. |

### Painel do Produto (sub-coluna direita, ~280px)

**Card do Produto Vinculado:**
- Foto do produto (ou placeholder com ícone Package)
- Código, nome, marca, linha, tipo
- Dados vêm de `linkedProduto` (já disponível via `useProjetoTarefaDetalhe`)
- Se não houver produto vinculado, mostrar estado vazio com botão "Vincular produto"

**Checklist de Pré-Lançamento:**
Lista fixa de etapas necessárias para lançamento, auto-calculada com base nos dados existentes:
- **Briefing** — check se existe doc no cofre com categoria "briefing"
- **Arte Final** — check categoria "arte_final" no cofre
- **Rótulo** — check categoria "rotulo"
- **Ficha Técnica** — check categoria "ficha_tecnica"
- **Laudo** — check categoria "laudo"
- **Certificado** — check categoria "certificado"
- **Aprovação cliente** — check se existe marco "aprovação" concluído

Cada item fica verde (check) se o documento correspondente existe no cofre ou o marco está concluído. Usa os dados de `cofreDocs` e `displayMetas` já disponíveis.

**Barra de Progresso Geral:**
- Percentual = itens do checklist concluídos / total
- Progress bar visual com cor dinâmica (vermelho < 30%, amarelo < 70%, verde >= 70%)


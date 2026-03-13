

# Vincular Módulos a Projeto → Seção → Tarefa + Checklist Padronizado

## Problema Atual

As tabelas dos 6 módulos (`produto_composicao`, `produto_amostras`, `produto_analise_embalagem`, `produto_etiqueta_bula`, `produto_fluxo_artes`, `fluxo_aprovacao_artes_instancias`) referenciam apenas `submissao_id`. Não existe vínculo direto com Projeto, Seção ou Tarefa — impossibilitando rastrear qual tarefa do projeto controla cada etapa e abrir detalhes pelo lado do Projeto.

## Solução

### 1. Tabela centralizada: `modulo_projeto_vinculos`

Uma única tabela de vínculos (mesmo padrão de `china_submissao_tarefa_vinculos`):

```sql
CREATE TABLE public.modulo_projeto_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL,           -- 'composicao' | 'amostras' | 'analise_embalagem' | 'etiqueta_bula' | 'fluxo_artes' | 'aprovacao_artes'
  registro_id UUID NOT NULL,      -- ID do registro no módulo
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  secao_id UUID REFERENCES projeto_secoes(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES projeto_tarefas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(modulo, registro_id, tarefa_id)
);
```

RLS: authenticated pode SELECT/INSERT/DELETE nos vínculos de projetos dos quais é membro.

### 2. Componente reutilizável: `VincularProjetoDialog`

Um dialog padronizado que qualquer módulo usa:

```text
┌─────────────────────────────────────────┐
│ Vincular ao Projeto                     │
├─────────────────────────────────────────┤
│ Projeto:    [▾ Selecionar projeto   ]   │
│ Seção:      [▾ Selecionar seção     ]   │
│ Tarefa:     [▾ Selecionar tarefa    ]   │
│                                         │
│ Vínculos atuais:                        │
│ ┌─────────────────────────────────────┐ │
│ │ 📂 Projeto Alpha > Regulatório >   │ │
│ │    Aprovação INCI       [🗑️ ×]     │ │
│ │ 📂 Projeto Alpha > Embalagem >     │ │
│ │    Validar Pantone      [🗑️ ×]     │ │
│ └─────────────────────────────────────┘ │
│                         [Vincular]      │
└─────────────────────────────────────────┘
```

Props: `modulo: string`, `registroId: string`, `open`, `onOpenChange`

Selects em cascata: Projeto → carrega Seções → carrega Tarefas (reutiliza `useSecoesETarefas` existente).

### 3. Widget inline: `VinculoProjetoBadges`

Componente pequeno que exibe os vínculos como badges clicáveis:

```text
📂 Projeto Alpha > Regulatório > Aprovação INCI  [→]
```

O `[→]` navega para `/dashboard/projetos/:projetoId` (se o usuário tem acesso).

### 4. Integração nos 6 módulos

Cada tela de detalhe ganha:
- Botão "Vincular ao Projeto" que abre o `VincularProjetoDialog`
- Lista de `VinculoProjetoBadges` mostrando vínculos existentes
- Ao clicar num badge, abre o detalhe da tarefa no Projeto (para quem tem acesso)

| Módulo | Arquivo de detalhe | Onde aparece |
|--------|-------------------|--------------|
| Composição | `ChecklistComposicao.tsx` | No painel expandido de cada submissão |
| Amostras | `RecebimentoAmostra.tsx` | No painel expandido de cada amostra |
| Embalagem | `AnaliseEmbalagem.tsx` | No painel expandido de cada análise |
| Etiqueta Bula | `ChecklistEtiquetaBula.tsx` | No painel expandido de cada etiqueta |
| Motor de Artes | `FluxoArtesDetalhe.tsx` | No header do detalhe do fluxo |
| Aprovação de Artes | `FluxoAprovacaoDetalhe.tsx` | No header do detalhe da instância |

### 5. Visão reversa: Widget no Projeto (Tarefa)

No `ProjetoTarefaDetalhe.tsx`, adicionar uma seção "Módulos Vinculados" que consulta `modulo_projeto_vinculos` pela `tarefa_id` e exibe:

```text
Módulos Vinculados
┌──────────────────────────────────────────┐
│ 🧪 Composição INCI    │ ✅ Aprovado     │ → Ver
│ 📦 Análise Embalagem  │ ⏳ Em Análise   │ → Ver
│ 🏷️ Etiqueta Bula     │ 🔄 Regulatório  │ → Ver
└──────────────────────────────────────────┘
```

O "→ Ver" navega para a rota do módulo correspondente. Assim, quem tem acesso ao Projeto pode abrir o detalhe de qualquer checklist vinculado.

### 6. Hook: `useModuloVinculos`

```typescript
// Queries
useVinculosDoRegistro(modulo, registroId)  // vínculos de um registro
useVinculosDaTarefa(tarefaId)              // vínculos reversos (para ProjetoTarefaDetalhe)

// Mutations
useCreateModuloVinculo()
useDeleteModuloVinculo()
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `modulo_projeto_vinculos` + RLS |
| `src/hooks/useModuloVinculos.ts` | **Criar** — queries e mutations |
| `src/components/shared/VincularProjetoDialog.tsx` | **Criar** — dialog de vinculação |
| `src/components/shared/VinculoProjetoBadges.tsx` | **Criar** — badges clicáveis |
| `src/components/shared/ModulosVinculadosWidget.tsx` | **Criar** — widget reverso para tarefas |
| `src/pages/ChecklistComposicao.tsx` | Integrar dialog + badges |
| `src/pages/RecebimentoAmostra.tsx` | Integrar dialog + badges |
| `src/pages/AnaliseEmbalagem.tsx` | Integrar dialog + badges |
| `src/pages/ChecklistEtiquetaBula.tsx` | Integrar dialog + badges |
| `src/pages/FluxoArtesDetalhe.tsx` | Integrar dialog + badges |
| `src/pages/FluxoAprovacaoDetalhe.tsx` | Integrar dialog + badges |
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Adicionar `ModulosVinculadosWidget` |


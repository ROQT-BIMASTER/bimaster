

# Cofre de Documentos: Produto → Matérias Primas → Documentos

## Problema Atual
A tabela `fabrica_revisao_documentos` só tem `produto_id`. Não há como vincular um documento a uma matéria-prima específica do produto.

## Plano

### 1. Migração DB — Adicionar coluna `materia_prima_id`
```sql
ALTER TABLE fabrica_revisao_documentos 
  ADD COLUMN materia_prima_id uuid REFERENCES fabrica_materias_primas(id);
```

### 2. Refatorar `DocumentosCofre.tsx` — Hierarquia de 3 níveis

Estrutura visual:
```text
┌─────────────────────────────────────────────┐
│ 📦 Produto A (código)              [5 docs] │
│   ▸ 🧪 Matéria Prima X              [2 docs]│
│   ▸ 🧪 Matéria Prima Y              [1 doc] │
│   ▸ 📄 Documentos Gerais            [2 docs]│
├─────────────────────────────────────────────┤
│ 📦 Produto B (código)              [3 docs] │
│   ▸ ...                                     │
└─────────────────────────────────────────────┘
```

- Ao clicar no produto, expandir mostrando subcategorias de matérias primas (buscadas via `fabrica_formula_itens` → `fabrica_materias_primas`)
- Documentos com `materia_prima_id` preenchido ficam agrupados sob a respectiva MP
- Documentos sem `materia_prima_id` ficam em grupo "Documentos Gerais" do produto
- Cada MP é um Collapsible interno com seus documentos
- Carregar nomes das MPs via join na query

### 3. Atualizar upload no chat (`RevisaoChatPanel.tsx`)
- Ao marcar "Vincular ao Cofre", mostrar um select opcional para escolher a matéria-prima do produto (carregar itens da fórmula ativa)
- Se nenhuma MP selecionada, documento fica como "geral" do produto

### 4. Atualizar `DocumentosTab.tsx`
- Agrupar documentos também por matéria-prima quando dentro do painel de análise do produto


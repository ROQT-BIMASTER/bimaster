

## Plano: Carregamento Completo + Trilha de Imagens + Histórico

### Contexto atual
- `ColunaChina` mostra apenas 5 campos estáticos do snapshot (`china_nome`, `china_codigo`, etc.)
- Não carrega dados ricos da submissão original (cores, fotos, documentos, pesos, EANs)
- Não existe tabela de imagens do produto nem timeline visual
- Não há registro de atividades no fluxo do produto

### Alterações

---

**1. Nova tabela `produto_brasil_imagens`**

Armazena fotos de todas as etapas do ciclo de vida do produto:

```sql
CREATE TABLE public.produto_brasil_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  image_path text,
  etapa text NOT NULL DEFAULT 'china_source',
  origem text NOT NULL DEFAULT 'china_supplier',
  descricao text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);
-- etapa: china_source, product_analysis, development, approved_catalog, marketing
-- origem: china_supplier, internal_team, marketing_team
```

**2. Nova tabela `produto_brasil_historico`**

Registra eventos do fluxo do produto:

```sql
CREATE TABLE public.produto_brasil_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL,
  descricao text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

RLS para ambas: `authenticated` pode SELECT/INSERT/UPDATE/DELETE.

---

**3. Enriquecer `ColunaChina` com dados reais da submissão**

Quando `produto.submissao_china_id` existe, buscar de `china_produto_submissoes`:
- Fornecedor (via `numero_ordem`), EANs (unidade, display, caixa master), pesos, fórmula, quantidade total
- Cores de `china_produto_cores` (nome, hex, foto, EAN, quantidade)
- Documentos de `china_produto_documentos` (tipo, arquivo, status)

Layout expandido: seção de cores com swatches visuais, seção de documentos com links, seção de dados técnicos (pesos, EANs).

---

**4. Componente `ImagemTimeline`**

Nova seção na tela `ProdutoBrasilCadastro.tsx` entre SKUs e Checklist:
- Timeline cronológica agrupada por etapa (5 estágios)
- Cada imagem mostra: thumbnail, origem, quem enviou, data, etapa
- Botão de upload por etapa (usa storage bucket `produto-brasil-imagens`)
- Auto-importa fotos de `china_produto_cores.foto_url` como `china_source` ao abrir pela primeira vez

---

**5. Componente `HistoricoAtividades`**

Seção colapsável no final da tela de cadastro:
- Lista cronológica de eventos (vinculação, edições, uploads, mudanças de status)
- Registrar automaticamente: criação, mudança de status, vinculação de projeto, upload de imagem
- Inserir registros no `useUpdateProdutoBrasil` e nas ações relevantes

---

**6. Hook `useProdutoBrasilImagens`**

CRUD de imagens + upload para storage + auto-importação das fotos China.

---

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| Migration SQL | 2 tabelas novas + RLS + storage bucket |
| `src/components/produto-brasil/ColunaChina.tsx` | Enriquecer com dados reais da submissão (cores, docs, pesos) |
| `src/components/produto-brasil/ImagemTimeline.tsx` | **Novo** — timeline visual de fotos por etapa |
| `src/components/produto-brasil/HistoricoAtividades.tsx` | **Novo** — log de eventos do produto |
| `src/hooks/useProdutoBrasil.ts` | Adicionar hooks de imagens e histórico |
| `src/pages/ProdutoBrasilCadastro.tsx` | Integrar ImagemTimeline e HistoricoAtividades |


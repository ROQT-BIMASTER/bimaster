

## Plano: Fluxo de Onboarding de Produto Importado (China → Brasil)

Este é um recurso complexo que envolve novas tabelas, páginas e automações. Recomendo implementar em **3 fases incrementais** para entregas rápidas e testáveis.

---

### Fase 1 — Fundação (botão voltar + tabela de cadastro Brasil + automação pós-vínculo)

**1.1 Botão Voltar na tela de vinculação**
- Adicionar `useNavigate` e um botão `ArrowLeft` no header de `ProjetoVincularChina.tsx`
- `navigate(-1)` para voltar ao contexto anterior

**1.2 Nova tabela `produtos_brasil`**
Armazena o cadastro adaptado para o mercado brasileiro, referenciando a submissão China original:

```sql
CREATE TABLE public.produtos_brasil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_china_id uuid REFERENCES public.china_submissoes(id),
  vinculo_id uuid REFERENCES public.china_submissao_tarefa_vinculos(id),
  projeto_id uuid REFERENCES public.projetos(id),
  -- Dados China (snapshot, read-only na UI)
  china_nome text,
  china_codigo text,
  china_ean text,
  china_categoria text,
  china_descricao text,
  -- Dados Brasil (editáveis)
  nome_brasil text,
  codigo_brasil text,
  categoria_brasil text,
  descricao_brasil text,
  observacoes text,
  -- Status do fluxo
  status text NOT NULL DEFAULT 'aguardando_precadastro',
  responsavel_precadastro_id uuid,
  responsavel_regulatorio_id uuid,
  -- Regulatório
  numero_registro text,
  status_anvisa text,
  categoria_regulatoria text,
  responsavel_tecnico text,
  data_aprovacao_regulatorio date,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**1.3 Nova tabela `produto_brasil_skus`** (variações)
```sql
CREATE TABLE public.produto_brasil_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  cor text,
  tamanho_grade text,
  codigo_interno text,
  ean text,
  quantidade_inicial integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**1.4 Nova tabela `produto_brasil_checklist_regulatorio`**
```sql
CREATE TABLE public.produto_brasil_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  item text NOT NULL,
  concluido boolean DEFAULT false,
  concluido_por uuid,
  concluido_em timestamptz,
  observacao text
);
```

**1.5 Automação pós-vínculo**
No `handleVincular` de `ProjetoVincularChina.tsx`:
- Após criar o vínculo, inserir um registro em `produtos_brasil` com os dados China como snapshot
- Criar automaticamente uma tarefa "Pré-cadastro Brasil — {produto_nome}" na seção do projeto
- Atribuir ao responsável configurado (usa `china_categoria_responsaveis` existente ou campo fixo)
- Popular o checklist regulatório com os 7 itens padrão

---

### Fase 2 — Tela de Pré-Cadastro (China x Brasil lado a lado)

**2.1 Nova página `ProdutoBrasilCadastro.tsx`**
- Rota: `/produto-brasil/:id`
- Layout em duas colunas responsivas

**Coluna esquerda — China (somente leitura):**
- Nome, código, EAN, grade, cores, quantidades, imagens, categoria, descrição
- Dados carregados do snapshot em `produtos_brasil` + documentos/fotos da submissão original

**Coluna direita — Brasil (editável):**
- Formulário com: nome, código interno, categoria, descrição, observações
- Seção de SKUs/variações com tabela editável inline (adicionar/remover linhas)
- Botão "Copiar dados da China" que preenche campos a partir do snapshot
- Destaque visual (borda amarela) para campos que divergem dos dados China

**2.2 Barra de status e ações**
- Status bar no topo mostrando o estado atual do produto no fluxo
- Botão "Salvar Rascunho" (salva sem mudar status)
- Botão "Enviar para Regulatório" (muda status para `aguardando_regulatorio` e cria tarefa automática para o time regulatório)

---

### Fase 3 — Workflow Regulatório e Status Pipeline

**3.1 Checklist regulatório na tela do produto**
- Seção colapsável com os 7 itens de validação
- Cada item: checkbox + campo observação + quem concluiu
- Campos adicionais: número de registro, status ANVISA, categoria regulatória, responsável técnico, data aprovação

**3.2 Status pipeline do produto**
Estados: `produto_importado` → `aguardando_precadastro` → `precadastro_em_andamento` → `aguardando_regulatorio` → `aprovado_cadastro` → `produto_ativo`
- Badge visual de status na listagem e na tela de detalhe
- Transições automáticas: ao vincular → `aguardando_precadastro`; ao enviar para regulatório → `aguardando_regulatorio`; ao completar checklist → `aprovado_cadastro`

**3.3 Histórico de alterações**
- Tabela `produto_brasil_historico` registrando cada mudança (campo, valor anterior, novo valor, usuário, timestamp)
- Timeline visual na tela do produto

---

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/...` | 3 tabelas novas + RLS + checklist items |
| `src/pages/ProjetoVincularChina.tsx` | Botão voltar + automação pós-vínculo |
| `src/pages/ProdutoBrasilCadastro.tsx` | Nova página (comparação China x Brasil) |
| `src/hooks/useProdutoBrasil.ts` | CRUD do cadastro Brasil + SKUs + checklist |
| `src/components/produto-brasil/` | Componentes: ColunaChina, ColunaBrasil, SkuTable, ChecklistRegulatorio, StatusPipeline |
| `src/App.tsx` | Nova rota `/produto-brasil/:id` |

### Recomendação de implementação

Sugiro começar pela **Fase 1** (fundação + automação) que já entrega valor imediato, e iterar nas fases 2 e 3 em sequência. Cada fase é funcional independentemente.


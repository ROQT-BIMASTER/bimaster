

# Sistema de Formularios Dinamicos — Plano de Implementacao

## Situacao Atual

O sistema possui um formulario fixo (`FormularioEquipe`) com campos hardcoded (nome, CPF, WhatsApp, camiseta, etc.), gerenciado via tokens (`team_form_tokens` / `team_form_submissions`). O supervisor gera um link com token e o vendedor preenche campos pre-definidos. Nao existe builder de formularios nem renderizacao dinamica.

## Solucao

Criar um sistema completo de formularios dinamicos com: builder visual, renderizacao automatica, e sugestao de campos via IA.

### 1. Novas Tabelas (Migration)

```sql
-- Formularios dinamicos
CREATE TABLE public.dynamic_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'equipe', 'pdv', 'auditoria', 'campanha'
  company_id UUID REFERENCES public.empresas(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'archived'
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campos do formulario
CREATE TABLE public.dynamic_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'text','number','date','select','checkbox','file','image','geolocation','grid','ean_scanner','price'
  required BOOLEAN DEFAULT false,
  options JSONB DEFAULT '[]', -- para select/checkbox
  placeholder TEXT,
  validation JSONB DEFAULT '{}', -- min, max, pattern, etc
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas (uma por preenchimento)
CREATE TABLE public.dynamic_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  token_id UUID REFERENCES public.team_form_tokens(id),
  user_id UUID REFERENCES auth.users(id),
  client_id UUID, -- vinculo opcional com store
  metadata JSONB DEFAULT '{}', -- geolocation, device, etc
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas individuais por campo
CREATE TABLE public.dynamic_form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.dynamic_form_responses(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.dynamic_form_fields(id) ON DELETE CASCADE NOT NULL,
  value JSONB NOT NULL -- texto, numero, array, upload URL, etc
);

-- RLS em todas as tabelas
ALTER TABLE public.dynamic_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_answers ENABLE ROW LEVEL SECURITY;
```

### 2. Builder de Formularios (Nova Pagina)

**Arquivo:** `src/pages/DynamicFormBuilder.tsx`

Interface visual estilo Google Forms:
- Campo de nome/descricao do formulario no topo
- Lista de campos com drag-and-drop (usando `@dnd-kit/sortable`)
- Cada campo renderiza um card com: label, tipo (dropdown), obrigatorio (toggle), opcoes (se select)
- Botao "Adicionar campo" no final
- Painel lateral de configuracao ao clicar num campo
- Botao "Sugerir campos com IA" que chama edge function com descricao do formulario e retorna campos sugeridos
- Preview em tempo real ao lado (desktop split view)

### 3. Renderizador Dinamico

**Arquivo:** `src/components/forms/DynamicFormRenderer.tsx`

Componente que recebe `formId`, busca campos do banco, e renderiza dinamicamente:

```text
fields.map(field => {
  switch(field.field_type) {
    'text' → Input
    'number' → Input type=number
    'date' → DatePicker
    'select' → Select com field.options
    'checkbox' → Checkbox group
    'file' → FileUpload (storage bucket)
    'image' → ImageCapture (camera + upload)
    'geolocation' → auto-captura GPS
    'grid' → tabela editavel
    'ean_scanner' → EanScanner existente
    'price' → Input monetario formatado
  }
})
```

Salva respostas em `dynamic_form_responses` + `dynamic_form_answers`.

### 4. Sugestao IA de Campos

**Arquivo:** `supabase/functions/suggest-form-fields/index.ts`

Edge function que recebe descricao do formulario (ex: "Pesquisa de preco no PDV") e retorna campos sugeridos usando Lovable AI (`google/gemini-3-flash-preview`). Usa tool calling para retornar JSON estruturado com array de campos (label, type, required, options).

### 5. Integracao com Tela Existente

**Arquivo:** `src/pages/TradeSupervisorDashboard.tsx` (aba Formularios)

- Substituir/complementar o sistema atual de tokens com opcao de criar formulario dinamico
- Botao "Criar Formulario Personalizado" ao lado do "Gerar Link Formulario"
- Lista de formularios dinamicos criados com status, contagem de respostas
- Ao gerar link, associar o `dynamic_form.id` ao token

### 6. Rota e Pagina Publica

**Arquivo:** `src/pages/DynamicFormPublic.tsx`

Pagina publica (sem auth) que recebe `?token=X&form=Y`, valida o token e renderiza o `DynamicFormRenderer`.

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | 4 novas tabelas + RLS |
| `supabase/functions/suggest-form-fields/index.ts` | Nova edge function IA |
| `src/pages/DynamicFormBuilder.tsx` | Nova — builder visual |
| `src/components/forms/DynamicFormRenderer.tsx` | Novo — renderizador dinamico |
| `src/components/forms/FormFieldCard.tsx` | Novo — card de campo no builder |
| `src/components/forms/FieldConfigPanel.tsx` | Novo — painel de config do campo |
| `src/pages/DynamicFormPublic.tsx` | Nova — pagina publica de preenchimento |
| `src/pages/TradeSupervisorDashboard.tsx` | Adicionar integracao com formularios dinamicos |
| `src/App.tsx` | Novas rotas |

## Implementacao em Fases

**Fase 1 (este ciclo):** Tabelas + Builder + Renderizador + Rota publica
**Fase 2:** Sugestao IA + importacao de estrutura por documento
**Fase 3:** Tipos avancados (grid, scanner EAN, geolocalizacao, camera)
**Fase 4:** Dashboard de respostas + vinculacao com cliente/produto/campanha


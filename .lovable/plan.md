

# Vinculação de Banners/Materiais a Formulários + Área Administrativa + Compartilhamento

## Resumo

Adicionar 3 capacidades ao sistema de formulários dinâmicos:
1. Vincular banners e materiais do catálogo diretamente a formulários
2. Área administrativa onde cada usuário vê/gerencia apenas seus formulários (ou formulários compartilhados)
3. Compartilhamento de resultados com outros usuários (marcar usuários para visualizar respostas)

## 1. Novas Tabelas (Migration)

```sql
-- Vinculação de banners e materiais a formulários
CREATE TABLE public.dynamic_form_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  attachment_type TEXT NOT NULL, -- 'banner' ou 'material'
  attachment_id TEXT NOT NULL, -- id do banner ou material
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compartilhamento de resultados com outros usuários
CREATE TABLE public.dynamic_form_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) NOT NULL,
  shared_with UUID REFERENCES auth.users(id) NOT NULL,
  permission TEXT DEFAULT 'view', -- 'view' ou 'edit'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(form_id, shared_with)
);

-- RLS para ambas
ALTER TABLE public.dynamic_form_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_shares ENABLE ROW LEVEL SECURITY;

-- Policies: owner ou admin pode gerenciar attachments
-- Policies: owner pode compartilhar, shared_with pode ler
```

## 2. Área Administrativa de Formulários (Nova Página)

**Arquivo:** `src/pages/DynamicFormAdmin.tsx`

Página dedicada com lista de formulários filtrada por:
- **Meus formulários** (created_by = user.id)
- **Compartilhados comigo** (via dynamic_form_shares)
- **Todos** (apenas para admins)

Cada card de formulário exibe: nome, categoria, status (draft/active), contagem de respostas, data de criação. Ações: Editar, Duplicar, Compartilhar, Ver Respostas, Excluir.

## 3. Vinculação de Banners e Materiais no Builder

**Arquivo:** `src/pages/DynamicFormBuilder.tsx` (atualizar)

Nova seção no painel lateral "Vínculos":
- Seletor de banners (busca em `trade_banners` ativos)
- Seletor de materiais (busca em `trade_materiais` ativos)
- Lista de itens vinculados com opção de remover
- Salva em `dynamic_form_attachments` junto com o form

No `DynamicFormRenderer`, os banners vinculados são exibidos como carrossel no topo e os materiais como cards informativos.

## 4. Compartilhamento de Resultados

**Arquivo:** `src/components/forms/FormShareDialog.tsx` (novo)

Dialog que permite:
- Buscar usuários do sistema (profiles)
- Marcar usuários para visualizar resultados (permission = 'view')
- Opção de conceder permissão de edição
- Lista de usuários já compartilhados com opção de remover

Acessível via botão "Compartilhar" na área administrativa.

## 5. Rota e Integração

| Arquivo | Ação |
|---------|------|
| Migration SQL | 2 novas tabelas + RLS |
| `src/pages/DynamicFormAdmin.tsx` | Nova — área administrativa |
| `src/components/forms/FormShareDialog.tsx` | Novo — dialog de compartilhamento |
| `src/components/forms/FormAttachmentsPanel.tsx` | Novo — painel de vínculos (banners/materiais) |
| `src/pages/DynamicFormBuilder.tsx` | Adicionar painel de vínculos no sidebar |
| `src/components/forms/DynamicFormRenderer.tsx` | Exibir banners/materiais vinculados |
| `src/App.tsx` | Nova rota `/dashboard/trade/formularios/admin` |
| `src/pages/TradeSupervisorDashboard.tsx` | Link para área administrativa |

## Detalhes Técnicos

```text
Filtro de formulários:
  SELECT f.*, 
    (SELECT count(*) FROM dynamic_form_responses r WHERE r.form_id = f.id) as total_respostas
  FROM dynamic_forms f
  WHERE f.created_by = $userId
     OR EXISTS (SELECT 1 FROM dynamic_form_shares s WHERE s.form_id = f.id AND s.shared_with = $userId)
     OR $isAdmin = true

Vinculação no builder:
  Save: INSERT INTO dynamic_form_attachments (form_id, attachment_type, attachment_id)
  Load: SELECT * FROM dynamic_form_attachments WHERE form_id = $id

Compartilhamento:
  INSERT INTO dynamic_form_shares (form_id, shared_by, shared_with, permission)
  → Respostas ficam visíveis para shared_with via RLS policy
```


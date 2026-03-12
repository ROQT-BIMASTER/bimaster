

## Sistema de Papéis e Permissões para Desenvolvimento de Produtos

### Situação Atual

O sistema já possui infraestrutura parcial:
- **`projeto_membros`**: papéis limitados a "coordenador" e "membro"
- **`fabrica_revisao_documentos`**: funciona como cofre com `visivel_fabrica`, `status`, `aprovado_por`
- **`projeto_tarefa_aprovacoes`**: workflow de aprovação multi-etapa (regulatório, qualidade, etc.)
- **`sendToCofre`**: envia documentos ao cofre sem validação de papel ou aprovação prévia

### Problemas Identificados
1. Qualquer membro pode enviar documentos ao cofre (sem controle de papel)
2. Não há controle de versão formal nos documentos
3. Não há separação entre "documentos de trabalho" e "cofre oficial"
4. A China pode acessar documentos antes da aprovação via `visivel_fabrica`
5. Não há status de processo formal por produto

---

### Plano de Implementação

#### 1. Migração SQL — Novo Sistema de Papéis e Estruturas

**Expandir papéis em `projeto_membros`:**
```sql
-- Enum para papéis de desenvolvimento de produto
CREATE TYPE public.dev_produto_papel AS ENUM (
  'gestor_produto',      -- Product Owner
  'regulatorio',         -- Regulatório/Compliance
  'design',              -- Design/Arte
  'controle_arte',       -- QA de Arte
  'admin_cofre',         -- Administrador do Cofre
  'diretoria',           -- Supervisão
  'coordenador',         -- Legacy
  'membro'               -- Legacy
);
```

**Nova tabela de versões de documentos:**
```sql
CREATE TABLE public.produto_documento_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES fabrica_revisao_documentos(id),
  versao INT NOT NULL DEFAULT 1,
  arquivo_path TEXT NOT NULL,
  tamanho BIGINT,
  enviado_por UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'rascunho', -- rascunho, em_revisao, aprovado, rejeitado
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  versao_oficial BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Nova tabela de status do processo por produto:**
```sql
CREATE TABLE public.produto_dev_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL,
  projeto_id UUID REFERENCES projetos(id),
  status TEXT NOT NULL DEFAULT 'submissao_criada',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(produto_id, projeto_id)
);
```

**Tabela de auditoria de documentos:**
```sql
CREATE TABLE public.produto_doc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID,
  versao_id UUID,
  produto_id UUID,
  acao TEXT NOT NULL, -- upload, revisao, aprovacao, rejeicao, publicacao_cofre, download
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS em todas as tabelas com `has_role` e `check_user_access`.

#### 2. Função SQL de Verificação de Papel no Produto

```sql
CREATE FUNCTION public.has_dev_papel(
  _user_id UUID, _projeto_id UUID, _papel dev_produto_papel
) RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projeto_membros
    WHERE user_id = _user_id AND projeto_id = _projeto_id
    AND papel = _papel::text
  )
$$;
```

Funções auxiliares:
- `can_publish_to_cofre(user_id, projeto_id)` — verifica se é `admin_cofre` ou `admin`
- `can_approve_doc(user_id, projeto_id)` — verifica se é `gestor_produto`, `regulatorio` ou `controle_arte`

#### 3. Frontend — Atualizar Dialog de Membros (`ProjetoMembrosDialog.tsx`)

- Expandir seletor de papel com os 6 novos papéis + ícones
- Mostrar badge visual do papel ao lado de cada membro
- Permitir que coordenadores/gestores atribuam papéis
- Exibir descrição do papel ao selecionar

#### 4. Frontend — Reforçar `sendToCofre` (`useProjetoTarefaDetalhe.ts`)

- Antes de enviar ao cofre, verificar se o usuário tem papel `admin_cofre`
- Verificar se todos os documentos relacionados à tarefa estão aprovados
- Verificar se a tarefa está concluída
- Bloquear envio com mensagem clara se condições não atendidas

#### 5. Frontend — Controle de Versão nos Documentos (`TarefaFocusMode.tsx`)

- Ao fazer upload de documento com mesmo nome, criar nova versão automaticamente
- Exibir histórico de versões com indicador de "versão oficial"
- Botão "Marcar como versão oficial" disponível apenas para `controle_arte` e `admin_cofre`

#### 6. Frontend — Barra de Status do Processo por Produto

- Componente `ProductDevStatusBar` com os 9 status em sequência visual
- Transições de status validadas pelo papel:
  - `gestor_produto`: avança fases principais
  - `regulatorio`: marca "Documentação aprovada"
  - `design`: marca "Arte em desenvolvimento" → "Arte em revisão"
  - `controle_arte`: marca "Arte aprovada"
  - `admin_cofre`: marca "Publicado no cofre" → "Liberado para produção"

#### 7. Frontend — Separação Visual de Áreas de Documentos

- Na `TarefaFocusMode`, criar duas abas:
  - **Documentos de Trabalho**: uploads livres, edição permitida para `design`
  - **Cofre Oficial**: somente leitura, documentos publicados com selo "VERSÃO OFICIAL"
- China vê apenas a aba "Cofre Oficial"

#### 8. Auditoria Automática

- Registrar em `produto_doc_audit_log` cada ação:
  - Upload de documento/versão
  - Revisão (aprovação/rejeição)
  - Publicação no cofre
  - Download pela China
- Exibir timeline de auditoria na ficha do produto

---

### Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| **Migration SQL** | Criar tabelas, enum, funções, RLS |
| `src/hooks/useProjetoMembros.ts` | Expandir papéis |
| `src/components/projetos/ProjetoMembrosDialog.tsx` | UI de papéis de dev |
| `src/hooks/useProjetoTarefaDetalhe.ts` | Validação no `sendToCofre` |
| `src/components/projetos/TarefaFocusMode.tsx` | Versões + separação de áreas |
| `src/components/projetos/ProductDevStatusBar.tsx` | **Novo** — Barra de status |
| `src/components/projetos/DocVersionHistory.tsx` | **Novo** — Histórico de versões |
| `src/components/projetos/CofreOficialTab.tsx` | **Novo** — Aba cofre oficial |
| `src/lib/productDocAudit.ts` | **Novo** — Funções de auditoria |

### Fluxo Resumido

```text
China envia docs → Brasil analisa → Regulatório valida
    → Design cria arte → Controle revisa → PO aprova
        → Admin Cofre publica → China recebe versão oficial
```

Cada transição é validada pelo papel do usuário e registrada no log de auditoria.


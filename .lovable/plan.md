

# Cofre de Documentos + Anexos no Chat de Revisão

## Visão Geral

Criar um sistema de documentos vinculados a produtos e revisões, com capacidade de anexar arquivos diretamente nas mensagens do chat e um "Cofre de Documentos" que consolida todos os documentos aprovados/finalizados por produto.

---

## 1. Banco de Dados — Nova Tabela `fabrica_revisao_documentos`

```sql
CREATE TABLE fabrica_revisao_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id uuid REFERENCES fabrica_ficha_custo_revisoes(id),
  produto_id uuid NOT NULL,
  mensagem_id uuid REFERENCES fabrica_revisao_mensagens(id),
  nome_arquivo text NOT NULL,
  arquivo_path text NOT NULL,
  tipo_arquivo text NOT NULL,
  tamanho integer DEFAULT 0,
  categoria text DEFAULT 'geral', -- 'orcamento', 'evidencia', 'nf', 'contrato', 'geral'
  status text DEFAULT 'ativo', -- 'ativo', 'aprovado', 'arquivado'
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_por uuid,
  enviado_por_nome text,
  created_at timestamptz DEFAULT now()
);
```

- Adicionar coluna `anexos` (jsonb) à `fabrica_revisao_mensagens` para inline attachment metadata.
- Criar bucket `fabrica-revisao-docs` (privado).
- RLS: acesso via `can_access_fabrica()`.

---

## 2. Chat — Anexar Documentos nas Mensagens (`RevisaoChatPanel.tsx`)

- Adicionar botão de clip (📎) ao lado do input de texto.
- Ao selecionar arquivos, fazer upload para `fabrica-revisao-docs/{revisao_id}/{timestamp}_{nome}`.
- Gravar registro em `fabrica_revisao_documentos` com `mensagem_id` e `revisao_id`.
- Salvar metadata dos anexos no campo `anexos` da mensagem (nome, path, tipo).
- Na renderização da mensagem, mostrar cards de anexos com ícone + nome + botão de download (signed URL).

---

## 3. Nova Aba "Documentos" na `FichaAnalisePanel.tsx`

- Adicionar 6ª tab "Documentos" no painel de análise da ficha.
- Listar todos os documentos vinculados àquele produto (`produto_id`), agrupados por categoria.
- Ações do diretor: marcar como "Aprovado" (status = 'aprovado'), categorizar.
- Filtro por categoria e status.

---

## 4. Cofre de Documentos — Nova aba na página `FichaRevisaoDiretoria.tsx`

- Adicionar aba "Cofre de Documentos" ao lado de "Fichas Pendentes" e "Comunicação".
- Componente `DocumentosCofre.tsx`:
  - Listar todos os documentos com `status = 'aprovado'`, agrupados por produto.
  - Busca por produto, filtro por categoria.
  - Download via signed URL.
  - Badge com total de documentos por produto.
  - Possibilidade de arquivar documentos obsoletos (`status = 'arquivado'`).

---

## Resumo de Entregas

| Entrega | Tipo |
|---|---|
| Tabela `fabrica_revisao_documentos` | Migração DB |
| Coluna `anexos` em `fabrica_revisao_mensagens` | Migração DB |
| Bucket `fabrica-revisao-docs` (privado) | Migração DB |
| Upload de anexos no chat | UI (RevisaoChatPanel) |
| Aba "Documentos" no painel de análise | UI (FichaAnalisePanel) |
| Cofre de Documentos aprovados | Novo componente (DocumentosCofre) |
| Aba "Cofre" na página de revisão | UI (FichaRevisaoDiretoria) |


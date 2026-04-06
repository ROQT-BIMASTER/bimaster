

# Orçamentos de Fornecedores Alternativos para Itens em Revisão

## Objetivo

Permitir que o usuário faça upload de orçamentos/propostas de fornecedores alternativos vinculados a cada item de revisão (`contas_pagar_revisao`), facilitando a comparação e decisão de substituição de serviços.

## Implementação

### 1. Migração SQL — Tabela `revisao_orcamentos_alternativos`

```sql
CREATE TABLE revisao_orcamentos_alternativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID REFERENCES contas_pagar_revisao(id) ON DELETE CASCADE NOT NULL,
  fornecedor_nome TEXT NOT NULL,
  valor_proposta NUMERIC(15,2) NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  validade DATE,
  selecionado BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE revisao_orcamentos_alternativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage orcamentos" ON revisao_orcamentos_alternativos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

RLS aberto para autenticados (mesma política da `contas_pagar_revisao`).

### 2. Componente `OrcamentosAlternativos.tsx`

Novo componente renderizado na área expandida de cada item (abaixo do histórico de pagamentos):

- **Lista de orçamentos** já cadastrados com: fornecedor, valor, validade, arquivo (download), badge "Selecionado"
- **Comparativo visual**: destaque em verde para o mais barato, badge de economia vs valor atual
- **Botão "Adicionar Orçamento"**: abre mini-form inline com campos:
  - Fornecedor (texto livre)
  - Valor da proposta (numérico)
  - Descrição (opcional)
  - Validade (date, opcional)
  - Upload de arquivo (PDF/imagem do orçamento)
- **Ação "Selecionar"**: marca um orçamento como escolhido e preenche automaticamente o campo `substituido_por` da revisão com o nome do fornecedor
- **Ação "Excluir"**: remove orçamento

### 3. Hook `useOrcamentosAlternativos.ts`

- Query: lista orçamentos por `revisao_id`
- Mutations: criar (com upload para storage bucket `revisao-orcamentos`), excluir, selecionar
- Ao selecionar: atualiza `contas_pagar_revisao.substituido_por` automaticamente

### 4. Integração no `PlanoReducaoGastos.tsx`

Na área expandida do item (linha ~667-719), adicionar o componente `OrcamentosAlternativos` abaixo do grid de detalhes existente, passando `revisaoId` e `valorAtual`.

### 5. Storage Bucket

Criar bucket `revisao-orcamentos` para armazenar os PDFs/imagens dos orçamentos.

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Criar tabela + RLS + bucket |
| `src/hooks/useOrcamentosAlternativos.ts` | Novo — CRUD + upload |
| `src/components/financeiro/OrcamentosAlternativos.tsx` | Novo — UI de orçamentos |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Integrar componente na área expandida |


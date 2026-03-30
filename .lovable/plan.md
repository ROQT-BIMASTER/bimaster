

# Importar Respostas da Planilha para o Formulário "envio Presskits"

## Resumo

A planilha tem 78 respostas com 10 colunas (Timestamp, E-mail, Razão Social, Qtd Lojas, Nome Completo, Telefone, Endereço, Cidade/Estado, CEP, Representante). O formulário atual tem apenas 5 campos genéricos (Nome, Cargo, Departamento, E-mail, Telefone) que não correspondem à planilha.

Precisamos: (1) atualizar os campos do formulário para refletir as colunas da planilha, (2) inserir as 78 respostas como `dynamic_form_responses` + `dynamic_form_answers`.

## Alterações

### 1. Migration — Atualizar campos do formulário + inserir dados

Uma única migration SQL que:

**a) Remove os 5 campos atuais** do formulário `d5db9e59-ac9b-45e5-8ad1-d878a06be621` e **cria 10 novos campos** mapeados às colunas da planilha:

| # | Label | Tipo | Obrigatório |
|---|-------|------|-------------|
| 0 | E-mail Corporativo | text | sim |
| 1 | Razão Social (Nome da Loja/Cliente) | text | sim |
| 2 | Quantas Lojas no TOTAL? | text | não |
| 3 | Nome Completo (responsável Marketing) | text | sim |
| 4 | Telefone com DDD | text | sim |
| 5 | Endereço | text | sim |
| 6 | Cidade, Estado | text | sim |
| 7 | CEP | text | não |
| 8 | Nome do Representante | text | não |

(Timestamp vira o `created_at` da response, não precisa de campo próprio)

**b) Insere 78 `dynamic_form_responses`** (uma por linha da planilha) com `created_at` do timestamp original e `metadata: {"fonte": "importacao_planilha"}`.

**c) Insere os `dynamic_form_answers`** correspondentes (78 × 9 campos = ~702 registros), cada um referenciando o `field_id` correto e `response_id` correto.

### 2. Atualizar status do formulário

Mudar o status de `draft` para `active` para que o dashboard funcione.

### Nenhuma alteração de código

Tudo é feito via migration SQL — os dados ficam disponíveis automaticamente no dashboard já criado.

## Detalhes técnicos

- A migration usará `gen_random_uuid()` para IDs
- Os valores serão inseridos como JSONB strings (ex: `'"nayiriasloja@gmail.com"'::jsonb`)
- O timestamp da planilha será convertido para `timestamptz`
- Campos antigos serão deletados com `DELETE FROM dynamic_form_fields WHERE form_id = '...'`
- Respostas antigas (se houver) também serão limpas


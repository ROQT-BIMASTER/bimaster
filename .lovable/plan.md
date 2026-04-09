

# Remover Numeros de Tabelas da Documentacao da API

## Problema
A secao de seguranca do Portal de APIs exibe o numero exato de tabelas do banco de dados (513) em dois pontos. Essa informacao e interna e nao agrega valor para o integrador — apenas expoe detalhes da infraestrutura.

## Alteracoes

### Arquivo: `src/components/erp/ApiDocumentation.tsx`

**1. Linha 2304** — Lista de garantias:
- De: `-- RLS (Row Level Security) em 513 tabelas -- isolamento total entre empresas`
- Para: `-- RLS (Row Level Security) em todas as tabelas -- isolamento total entre empresas`

**2. Linhas 2365** — Secao de isolamento multi-tenant:
- De: `O sistema implementa Row Level Security (RLS) em todas as 513 tabelas do banco de dados.`
- Para: `O sistema implementa Row Level Security (RLS) em todas as tabelas do banco de dados.`

Total: 2 substituicoes de string. Nenhuma mudanca funcional.


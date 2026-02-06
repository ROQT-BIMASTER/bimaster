

## Plano: Normalizar Municípios e Filtrar Clientes sem CNPJ Completo

### Contexto do Problema

A base atual possui **35.997 clientes**, dos quais:
- **27.350** possuem CNPJ completo (14 caracteres)
- **8.647** possuem CNPJ incompleto ou nulo (serão excluídos das análises)

O cálculo de penetração está distorcido porque o ERP registra variações de nomes de cidades que não correspondem ao padrão IBGE:
- **DF**: "BRASÍLIA", "BRASILIA", "TAGUATINGA", "VICENTE PIRES" contados como 4 municípios, mas o IBGE reconhece apenas 1 (resultado: 400%)
- **PR**: 447 variações para 399 municípios IBGE (112%)
- **RJ**: 100 variações para 92 municípios (108.7%)
- No total: **821 nomes de cidades** na base não correspondem a nenhum município IBGE

A maioria dos problemas vem de:
1. Acentos removidos no ERP ("MARINGA" vs "Maringá")
2. Bairros/regiões administrativas registrados como cidades ("TAGUATINGA" ao invés de "Brasília")

---

### O que será feito

**Etapa 1 -- Preparação do Banco**

- Instalar a extensão `unaccent` no PostgreSQL para comparação sem acentos
- Adicionar duas novas colunas na tabela `clientes`:
  - `ibge_municipio_id` (integer, nullable) -- referência ao município IBGE correspondente
  - `cidade_normalizada` (text, nullable) -- nome oficial IBGE após normalização
- Criar índice na coluna `ibge_municipio_id` para performance

**Etapa 2 -- Função de Normalização em Lote**

Criar uma RPC `fn_normalizar_municipios_clientes()` que:
1. Para cada cliente com CNPJ completo (14 dígitos), cidade e UF preenchidos
2. Tenta fazer match entre `UPPER(unaccent(cidade))` e `UPPER(unaccent(ibge_municipios.nome))` na mesma UF
3. Se encontrar, atualiza `ibge_municipio_id` e `cidade_normalizada` com o nome oficial
4. Se não encontrar match direto, tenta match por similaridade (substring) para casos como "TAGUATINGA" que deve apontar para "Brasília" no DF
5. Registra os casos sem match para revisão posterior

**Etapa 3 -- Corrigir todas as RPCs de análise**

Atualizar as seguintes funções para adicionar o filtro de CNPJ completo:

- `fn_calcular_cobertura_mercado` -- usar `ibge_municipio_id` ao invés de `UPPER(TRIM(cidade))` para contar municípios distintos, e filtrar `LENGTH(TRIM(cnpj)) = 14`
- `get_portfolio_kpis` -- adicionar `WHERE LENGTH(TRIM(cnpj)) = 14`
- `get_concentracao_uf` -- adicionar filtro CNPJ
- `get_faixas_ticket` -- adicionar filtro CNPJ
- `get_potencial_uf` -- adicionar filtro CNPJ
- `get_reativacao_kpis` -- adicionar filtro CNPJ

**Etapa 4 -- Atualizar o hook de Reativação**

No `useClienteReativacao.ts`, adicionar o filtro de CNPJ na query do `fetchAllRows` para que apenas clientes com CNPJ completo sejam carregados na lista.

**Etapa 5 -- Criar relatório de divergências**

Criar uma nova aba ou seção no dashboard de Inteligência Comercial que mostre:
- Total de clientes normalizados com sucesso vs. sem match
- Lista de cidades que não foram normalizadas (agrupadas por UF)
- Botão para executar a normalização manualmente

---

### Detalhes Técnicos

**Migração SQL principal:**

```sql
-- 1. Extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Novas colunas
ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS ibge_municipio_id integer,
  ADD COLUMN IF NOT EXISTS cidade_normalizada text;

CREATE INDEX idx_clientes_ibge_municipio ON clientes(ibge_municipio_id);

-- 3. Função de normalização em lote
CREATE OR REPLACE FUNCTION fn_normalizar_municipios_clientes()
RETURNS jsonb ...
-- Match por unaccent + UPPER + TRIM
-- Casos especiais (bairros -> município oficial, ex: DF)
-- Retorna estatísticas: {normalizados, sem_match, total}

-- 4. Atualizar fn_calcular_cobertura_mercado
-- Trocar COUNT(DISTINCT UPPER(TRIM(cidade))) 
-- por COUNT(DISTINCT ibge_municipio_id)
-- Adicionar WHERE cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14

-- 5. Atualizar get_portfolio_kpis, get_concentracao_uf, etc.
-- Adicionar filtro CNPJ em todas
```

**Fluxo de normalização:**

```text
Cliente ERP               Match Unaccent          Resultado
-----------------         ---------------         ------------------
"MARINGA" / PR    --->    "Maringá" / PR    --->  ibge_municipio_id = 4115200
"BRASILIA" / DF   --->    "Brasília" / DF   --->  ibge_municipio_id = 5300108
"TAGUATINGA" / DF --->    sem match direto  --->  Match especial DF -> 5300108
"FOZ DO IGUACU"   --->    "Foz do Iguaçu"  --->  ibge_municipio_id = 4108304
```

**Impacto esperado:**
- DF: de 400% para 100% (1 município)
- PR: de 112% para valor real (provavelmente ~80-90%)
- RJ: de 108.7% para valor real
- 8.647 clientes sem CNPJ completo serão excluídos de todas as métricas
- Total de clientes nas análises: ~27.350


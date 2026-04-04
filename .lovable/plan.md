
# Corrigir Dicionário e Melhorar IA da Classificação em Lote

## Problema Identificado

O dicionário hardcoded em `classificar-contas-lote/index.ts` tem **entradas obsoletas** que apontam para contas que viraram **grupos** após a reestruturação:

| Categoria ERP | Mapeia para | Status Atual |
|---|---|---|
| EMBALAGENS | `2.2` | **GRUPO** (não permite lançamento) |
| CAIXAS TERCIARIA | `2.2` | **GRUPO** |
| ETIQUETAS DIVERSAS | `2.2` | **GRUPO** |
| SEGURO BENS | `3.1.11` | **GRUPO** |
| SEGURO DEPOSITO | `3.1.11` | **GRUPO** |
| SEGUROESCRITORIO | `3.1.11` | **GRUPO** |
| SEGURO DE PESSOAL | `3.1.11` | **GRUPO** |

Quando o dicionário encontra o código mas a conta é grupo (`permite_lancamento=false`), a `contas.find()` retorna `undefined` e a categoria cai no fallback de IA — que pode falhar por truncamento de tokens.

## Correções

### 1. Atualizar dicionário com novos códigos (12 entradas)
- `EMBALAGENS` → `2.2.1` (Embalagem Primária)
- `CAIXAS TERCIARIA` → `2.2.3` (Embalagem Terciária)
- `ETIQUETAS DIVERSAS` → `2.2.4` (Materiais de Postagem)
- `SEGURO DEPOSITO` → `3.1.11.1` (Seguro de Galpão/Depósito)
- `SEGUROESCRITORIO` → `3.1.11.2` (Seguro de Escritório)
- `SEGURO BENS` → `3.1.11.3` (Seguro de Bens e Equipamentos)
- `SEGURO DE PESSOAL` → `3.2.12.2` (Plano de Saúde — já estava correto no plano)
- `TARIFAS BANCARIAS` → `3.4.1` (já correto, verificar existência)

### 2. Melhorar o fallback de IA
- Trocar modelo de `gemini-2.5-flash` para `google/gemini-2.5-pro` (melhor raciocínio)
- Adicionar `max_tokens: 8192` para evitar truncamento
- Adicionar validação: se o código retornado pela IA não existe no plano, marcar como `erro` em vez de aceitar silenciosamente
- Reduzir batch de IA de 25 para 10 categorias por vez para melhor precisão

### 3. Adicionar validação no dicionário (runtime)
- Ao resolver pelo dicionário, se a conta não for encontrada (grupo ou inexistente), logar warning e enviar para IA em vez de falhar silenciosamente

## Arquivo Alterado
- `supabase/functions/classificar-contas-lote/index.ts`

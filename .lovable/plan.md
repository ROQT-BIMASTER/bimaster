

# Relatório Técnico — AP Module (Revisado)

## Revisão do Escopo

Voce tem razao. A auditoria do `ApiDocumentation.tsx` confirma **~168 endpoints** distribuidos em **4 modulos** e **30+ APIs**. O relatorio tecnico do AP Module precisa refletir esse universo completo, nao apenas os ~30 do `contas-pagar-api`.

### Contagem real por modulo:

| Modulo | APIs | Endpoints |
|---|---|---|
| **Geral** | clientes (10+5+4), empresas (3), departamentos (6), categorias (7), projetos (7), parcelas (3) | **45** |
| **Cadastros Auxiliares** | tipos-atividade (2), tipos-anexo (2), tipos-entrega (6), tipos-documento (3), cnae (2), cidades (2), paises (2), bancos (3), bandeiras (2), origens (2), finalidades (3), dre (2) | **31** |
| **Financas** | contas-pagar (19), contas-receber (13), boletos (6), contas-correntes (9), lancamentos-cc (10), exportacao-erp (11), orcamentos (4), pesquisar (2), movimentos (2), resumo (5) | **81** |
| **Complementar** | anexos (6), webhook-inbound (1) | **7** |
| **Webhooks Outbound** | dispatcher + subscriptions (nao contabilizados na doc atual) | **~12** |
| **TOTAL** | | **~176** |

## O que muda no plano

O `RelatorioAPModule.tsx` tera na **Secao 2 (AS-IS)** a contagem e listagem real de TODOS os 176 endpoints, agrupados por modulo, com a coluna "Relevancia para AP" indicando se o endpoint e direto (ex: contas-pagar), indireto (ex: categorias, fornecedores) ou auxiliar (ex: bancos, cidades).

### Estrutura revisada:

**Secao 2 — Cenario Atual**: Tabela com os 176 endpoints reais, filtro por "Relevancia AP" (Direto/Indireto/Auxiliar), contadores por modulo, bloco colapsavel com schema completo.

**Secao 3 — Cenario Futuro**: Endpoints novos planejados alem dos 176 existentes (aprovacao multinivel, conciliacao automatica, relatorios avancados).

**Secoes 4-7**: Mantidas conforme plano original (Mapa de Telas, Fluxogramas, Checklist, Glossario).

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/RelatorioAPModule.tsx` | Criar (~1200 linhas) com os 176 endpoints mapeados |
| `src/App.tsx` | Adicionar lazy import + rota `/dashboard/relatorio-ap-module` |

A pagina continua 100% estatica, somente leitura, dados mock/placeholder baseados nos endpoints reais do `ApiDocumentation.tsx`. Nenhum arquivo existente sera modificado alem da adicao da rota.


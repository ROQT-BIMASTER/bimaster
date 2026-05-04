# Inventário de TODOs — Bi Master

Total: **52 ocorrências em 22 arquivos**. Categorização para triagem humana.
Esta rodada **não apaga, não reformata, não muda categoria** — apenas inventaria.

## Categorias

- **FEATURE-NOTE**: nota de funcionalidade futura prevista — manter, mas
  reformatar como `[FEATURE-NOTE] descrição` em vez de `TODO:`
- **TECH-DEBT**: dívida técnica reconhecida — adicionar ao backlog
- **BUG**: bug não-crítico que precisa virar issue GitHub
- **OBSOLETO**: comentário velho referenciando coisa que não existe — remover
- **DESCONHECIDO**: precisa contexto humano para classificar
- **FALSO-POSITIVO**: grep capturou palavra PT "TODOS" / placeholder "XX.XXX"
  / strings de changelog — ignorar

> Observação: o grep `TODO|FIXME|HACK|XXX|@deprecated` em projeto majoritariamente
> em português gera **muitos falsos positivos** com a palavra `TODOS` (plural de
> "todo") e com placeholders de CNPJ/telefone (`XX.XXX.XXX/XXXX-XX`).
> Após filtragem manual, apenas **~10 ocorrências** são marcadores genuínos.

## Lista por arquivo

### src/lib/version.ts (6 ocorrências)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 538 | FALSO-POSITIVO | "pré-valida disponibilidade de TODOS os componentes" | Ignorar |
| 622 | FALSO-POSITIVO | "lista TODOS os ativos via RLS" | Ignorar |
| 1235 | FEATURE-NOTE | "legados @deprecated mantidos por 1 versão" | Manter |
| 1389 | FALSO-POSITIVO | "Limpar TODOS os caches" | Ignorar |
| 1403 | FALSO-POSITIVO | "Limpa TODOS os caches do navegador" | Ignorar |
| 1423 | FALSO-POSITIVO | "Forçar desregistro de TODOS os Service Workers" | Ignorar |

### src/components/erp/ApiDocumentation.tsx (10)

Todas as 10 ocorrências são strings de **changelog histórico** (entradas grandes
documentando releases) que mencionam "TODOS os registros", "@deprecated zerado em
TS/JS", placeholders `XXX` em URLs de exemplo, etc.

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 2822 | FALSO-POSITIVO | "Array com TODOS os registros" | Ignorar |
| 2836 | FALSO-POSITIVO | "Lista com TODOS os registros" | Ignorar |
| 3657 | FALSO-POSITIVO | Changelog menciona "MFA TODOS" / `@deprecated` | Ignorar |
| 3690 | FALSO-POSITIVO | Changelog "TODOS OS PROJETOS" | Ignorar |
| 3729 | FALSO-POSITIVO | Changelog "valida disponibilidade de TODOS" | Ignorar |
| 3738 | FALSO-POSITIVO | Changelog "@deprecated" referência | Ignorar |
| (demais) | FALSO-POSITIVO | Strings de release notes | Ignorar |

### src/components/erp/SdkDownloadButtons.tsx (8)

Mistura de geradores de SDK (linha 24, 60, 87) e definições de tipos legados
genuinamente `@deprecated` (linhas 486, 488, 490, 492). Os `@deprecated` de
SDK são **intencionais** e parte do contrato público.

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 24 | FALSO-POSITIVO | Comentário gerado em código exportado | Ignorar |
| 60 | FALSO-POSITIVO | "11 MÉTODOS NOVOS" | Ignorar |
| 87 | FALSO-POSITIVO | "JSDoc @deprecated zerado" | Ignorar |
| 486 | FEATURE-NOTE | `@deprecated Use tipo_conta_corrente` | Manter (contrato SDK) |
| 488 | FEATURE-NOTE | `@deprecated Use codigo_banco` | Manter (contrato SDK) |
| 490 | FEATURE-NOTE | `@deprecated Use codigo_agencia` | Manter (contrato SDK) |
| 492 | FEATURE-NOTE | `@deprecated Use numero_conta_corrente` | Manter (contrato SDK) |
| 4240 | FALSO-POSITIVO | "Buscar TODOS os registros" em docstring Python | Ignorar |

### src/components/configuracoes/DocumentacaoIntegracaoERP.tsx (4)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 1894 | FALSO-POSITIVO | URL exemplo `?sync_id=XXX` | Ignorar (placeholder docs) |
| 2215 | FALSO-POSITIVO | URL exemplo `&distribuidora_id=XXX` | Ignorar |
| 2236 | FALSO-POSITIVO | "&categoria=XXX" | Ignorar |
| 2245 | FALSO-POSITIVO | URL exemplo `&estoque_id=XXX` | Ignorar |

### src/pages/Projetos.tsx (3)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 34 | FALSO-POSITIVO | `VER_TODOS_KEY` (chave localStorage) | Ignorar |
| 94 | FALSO-POSITIVO | uso de `VER_TODOS_KEY` | Ignorar |
| 115 | FALSO-POSITIVO | uso de `VER_TODOS_KEY` | Ignorar |

### src/components/china/ChinaDocumentSlot.tsx (2)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 28 | TECH-DEBT | `@deprecated Use \`files\` instead` | Confirmar migração; remover prop |
| 36 | TECH-DEBT | `@deprecated Use \`onRemoveFile\`` | Confirmar migração; remover prop |

### src/pages/financeiro/ConciliacaoManualAP.tsx (2)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 19 | FALSO-POSITIVO | `METODOS_PAGAMENTO` (constante) | Ignorar |
| 314 | FALSO-POSITIVO | uso de `METODOS_PAGAMENTO` | Ignorar |

### src/hooks/useTradeSupervisorDashboard.ts (2)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 56 | FALSO-POSITIVO | comentário "Admin vê TODOS" | Ignorar |
| 84 | FALSO-POSITIVO | comentário "buscar TODOS os usuários" | Ignorar |

### src/components/cobranca/TemplatesMensagem.tsx (2)

| Linha | Categoria | Texto resumido | Ação sugerida |
|---|---|---|---|
| 128 | FALSO-POSITIVO | placeholder telefone `(XX) XXXX-XXXX` | Ignorar |
| 129 | FALSO-POSITIVO | placeholder WhatsApp `(XX) XXXXX-XXXX` | Ignorar |

### Demais arquivos (1 ocorrência cada)

| Arquivo | Linha | Categoria | Ação sugerida |
|---|---|---|---|
| src/pages/Empresas.tsx | 331 | FALSO-POSITIVO | Placeholder CNPJ `XX.XXX.XXX/XXXX-XX` — ignorar |
| src/pages/Fornecedores.tsx | 786 | FALSO-POSITIVO | Mesmo placeholder — ignorar |
| src/pages/FluxoDeCaixa.tsx | 557 | FALSO-POSITIVO | Comentário "TODOS os dados" — ignorar |
| src/pages/DREAnalitico.tsx | 1514 | FALSO-POSITIVO | Texto de relatório — ignorar |
| src/lib/utils/fetchAllRows.ts | 4 | FALSO-POSITIVO | "Busca TODOS os registros" em JSDoc — ignorar |
| src/lib/logger.ts | 49 | TECH-DEBT | `// TODO: coletor externo (Sentry/Logtail)` — manter, backlog observabilidade |
| src/lib/fabrica/custo-calculator.ts | 22 | FEATURE-NOTE | `@deprecated Use calcularMargemComTabelaBase` — manter, alias para migração |
| src/hooks/useFilterMismatch.ts | 34 | FALSO-POSITIVO | "passa em TODOS os filtros" — ignorar |
| src/components/processos/ProcessoModulosResumoBanner.tsx | ? | DESCONHECIDO | Verificar contexto |
| src/components/marketing/SchedulePostDialog.tsx | ? | DESCONHECIDO | Verificar contexto |
| src/components/fluxocaixa/AnaliseInadimplencia.tsx | 25 | FALSO-POSITIVO | "TODOS os dados RAW" — ignorar |
| src/components/admin/AtribuirProspectsDialog.tsx | ? | DESCONHECIDO | Verificar contexto |
| src/components/ErrorBoundary.tsx | 64 | FEATURE-NOTE | `// TODO: Enviar para Sentry` — manter, mesmo backlog do logger |

## Sumário

| Categoria | Contagem |
|---|---|
| FALSO-POSITIVO | ~38 |
| FEATURE-NOTE (@deprecated SDK + Sentry) | 7 |
| TECH-DEBT | 4 |
| DESCONHECIDO | 3 |
| BUG | 0 |
| OBSOLETO | 0 |

## Próxima ação

Triagem humana decide:

- **TECH-DEBT** (`china/ChinaDocumentSlot` props deprecadas, `logger.ts` integração
  Sentry): virar issues no backlog
- **FEATURE-NOTE @deprecated SDK**: manter — contratos públicos com prazo de
  remoção em release maior; já documentados em `ApiDocumentation.tsx`
- **DESCONHECIDO**: pedir contexto ao autor
- **FALSO-POSITIVO**: nenhuma ação; o ruído vem do grep aplicado a projeto PT.
  Considerar regex mais estrita em futuras varreduras: `\b(TODO|FIXME|HACK|XXX):` (com `:`)

# Especificações do Briefings v2 — Intake Ruby Rose

Specs canônicas do agente de intake da Ruby Rose, fonte de verdade para o Briefings v2 dentro do Huggs/BiMaster.

## Origem

Pacote `huggs-agent-rr.zip` recebido em 2026-05-20. Mantido na íntegra como referência versionada — qualquer alteração deve passar por PR para preservar o audit trail das decisões feitas a partir destas specs.

## Índice

| Arquivo | Conteúdo | Consumido por |
|---|---|---|
| [00-visao-geral.md](./00-visao-geral.md) | Propósito, métricas-problema (62% sem prazo etc.), 8 tipos de demanda, princípio "1 item = 1 task = 1 briefing" | Documentação geral |
| [01-fluxo-de-conversa.md](./01-fluxo-de-conversa.md) | Fluxo em 4 fases, classificação, **catálogo padrão PDV (12 itens)**, **catálogo padrão Evento (16 brindes)**, validações, casos especiais | PR2 (seed catálogos), PR3 (prompt) |
| [02-perguntas-por-tipo.md](./02-perguntas-por-tipo.md) | Árvores de perguntas para os 8 tipos com **coluna Obrigatório por campo**, opções de select, regras gerais de coleta (defaults globais) | PR2 (seed obrigatórios + defaults + catálogos de Embalagem/Campanha/E-commerce/Press Kit/Catálogo/Material Interno), PR3 (prompt) |
| [03-estrutura-briefing.md](./03-estrutura-briefing.md) | Cabeçalho universal, **regras de status automático**, campos específicos por tipo, **dimensões padrão PDV**, exemplos de briefing gerado, convenção de nomenclatura | PR2 (seed templates + defaults dimensionais), PR3 (prompt) |
| [04-regras-decomposicao.md](./04-regras-decomposicao.md) | Padrões DEC-* (9 algoritmos de decomposição: PDV-ENXOVAL, PDV-SPECIFIC, PDV-STORE, EMB-PRODUCT, EMB-COMPONENT, EMB-LINE, EVT-BRINDE, ECOMM-BRAND, CAMP-DESDOBRAMENTO), tabela de N típico por tipo | PR3 (tool `decompor_em_briefings` no agente) |
| [05-prompt-sistema.md](./05-prompt-sistema.md) | System prompt completo proposto originalmente para o agente (8 tipos + fluxo 4 fases + casos especiais + variáveis de contexto) | PR3 (base do SYSTEM_PROMPT do briefing-agent) |
| [06-skills.md](./06-skills.md) | Definição detalhada de cada skill por tipo (perguntas ordenadas, lógica de decomposição, estrutura de saída por tipo) | PR3 (skills do agente) |
| [07-exemplos-conversa.md](./07-exemplos-conversa.md) | 3 conversas completas end-to-end (Enxoval PDV, Embalagem, Evento) com decomposição e geração dos briefings | PR3 (calibração do prompt), QA manual de todos os PRs |

## Decisões já tomadas a partir destas specs

Registradas em conversas anteriores, ficam aqui para evitar arqueologia:

- **Stack do agente**: Lovable AI Gateway (Gemini/GPT-5.2), não Claude direto — política Core de modelo do Huggs
- **Tipos**: substituídos os 4 antigos (`marketing`, `criativo`, `produto`, `trade`) pelos 8 das specs (`pdv`, `embalagem`, `evento`, `campanha`, `ecommerce`, `presskit`, `catalogo`, `material_interno`). Tipo legado preservado em `briefings.tipo_legado`
- **Multi-marca**: catálogos por empresa com override opcional por marca (estrutura `(empresa_id, marca text nullable, tipo, itens jsonb)`, fallback marca → empresa via `rpc_lookup_catalogo`)
- **Demanda-mãe**: tabela própria `intake_demandas` com FK `briefings.intake_demanda_id`. Códigos `DEM-AAAA-MM-DD-NNN` e `BRF-AAAA-MM-DD-NNN` (3 dígitos)
- **Status**: `briefings.status` continua operacional/manual (rascunho/em_andamento/final/arquivado); `calc_briefing_status(tipo, payload)` retorna status derivado de prontidão (Pronto/Aguardando Faca/Medidas/KV/Regulatório) em query, sem persistir
- **Completeness**: `briefing_campos_obrigatorios(empresa_id, tipo, campo, peso)`. **Peso 10 = bloqueia botão "Concluir lote" no PR4**. Peso 1–9 afeta só `completeness_score`

## Como os PRs consomem essas specs

| PR | Status | Specs consumidas |
|---|---|---|
| PR1 — Schema | Aplicado | (estrutural, sem leitura de spec) |
| PR2 — Seed | Em proposta | 01, 02, 03 |
| PR3 — Prompt + skills | Pendente | 05, 06, 04, 07 |
| PR4 — UI | Pendente | 00, 03 (status), 07 (UX dos exemplos) |
| PR5+ — Anexos, persistência completa, n8n webhook, retention de audit | Backlog | conforme necessidade |

## Convenções ao referenciar essas specs em PRs

Ao referenciar uma spec dentro de comentários, código ou documentação de PR, use o caminho completo a partir da raiz do repo:

```
docs/briefing-especificacoes/02-perguntas-por-tipo.md
```

Para apontar uma seção específica, anexe o anchor do heading (kebab-case do título da seção):

```
docs/briefing-especificacoes/02-perguntas-por-tipo.md#1-material-pdv
```

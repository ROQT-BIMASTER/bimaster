
# Contas a Pagar API — Cobertura Completa ✅

## Novas Rotas Implementadas (9 endpoints)

### Prioridade 1 — Essencial ✅
| Rota | Método | Descrição |
|------|--------|-----------|
| `/query` | GET | Consulta avançada com filtros (empresa, status, datas, paginação) |
| `/update` | PUT | Atualização individual de título (campos permitidos com whitelist) |
| `/cancelar` | POST | Cancelamento com motivo obrigatório (suporta batch via `ids`) |
| `/registrar-pagamento` | POST | Baixa via API com atualização automática do saldo |

### Prioridade 2 — Dados Complementares ✅
| Rota | Método | Descrição |
|------|--------|-----------|
| `/parcelas` | GET | Consulta parcelas de um título |
| `/parcelas/sync` | POST | Sync de parcelas do ERP (limite: 5000) |
| `/pagamentos` | GET | Histórico de pagamentos |

### Prioridade 3 — Avançado ✅
| Rota | Método | Descrição |
|------|--------|-----------|
| `/estornar` | POST | Estorno com recalculação de saldo e status |
| `/anexos` | GET/POST | Consultar e registrar comprovantes |

## Documentação
- `docs/API_CONTAS_PAGAR.md` — Documentação completa com exemplos de request/response

## Total: 21 rotas no contas-pagar-api

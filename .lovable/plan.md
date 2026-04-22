

# Auditoria: APIs do Portal ERP × dependência de N8N

## Resultado da auditoria

**Confirmado: nenhum endpoint público do Portal ERP tem dependência funcional de N8N.** O integrador externo nunca precisa de `N8N_API_KEY`, webhook N8N ativo, ou workflow N8N rodando para usar a API de Contas a Pagar.

### Endpoints listados no Portal ERP — Contas a Pagar (16 rotas)

| Seção (Portal) | Endpoints | Auth aceita | Depende de N8N? |
|---|---|---|---|
| Consulta & Gestão | `GET /query`, `PUT /update`, `POST /cancelar`, `POST /cancelar-lote`, `GET /status` | JWT ou API Key do integrador | Não |
| Integração CRUD | `GET /consultar`, `POST /incluir`, `DELETE /excluir`, `POST /upsert`, `POST /upsert-lote`, `POST /lancar-pagamento` | JWT ou API Key do integrador | Não |
| Parcelas, Pagamentos & Anexos | `GET /parcelas`, `POST /parcelas/sync`, `GET /pagamentos`, `POST /estornar`, `GET /anexos`, `POST /anexos` | JWT ou API Key do integrador | Não |

Esses 16 endpoints rodam pelo `secureHandler` (WAF, rate-limit, validação Zod) e usam o helper de auth dual (`validateJWT` ou `validateApiKey`). Nenhum chama N8N, nenhum exige `N8N_API_KEY`, nenhum aciona webhook N8N para responder.

### Endpoints onde N8N aparece — todos NÃO listados no Portal

| Endpoint | Onde aparece | Por que não é problema |
|---|---|---|
| `POST /trigger-n8n` | Tela admin interna (botão "disparar sync"). Não está em `contasPagarCrud`/`Integracao`/`Complementar`. | Rota administrativa para operação manual. Devolve 400 amigável se webhook não configurado — não quebra nada para o integrador. |
| `POST /bulk-sync`, `/sync-incremental`, `/sync-chunk`, `/sync-complete`, `/sync` (legado) | Sem entrada no Portal. | Exigem `N8N_API_KEY` e são restritas ao pipeline interno PowerBI→N8N. Integrador externo não vê nem precisa. |
| `GET /last-sync` (admin) | Sem entrada no Portal. | Aceita JWT **ou** `N8N_API_KEY` — N8N é alternativa opcional, não obrigatória. |
| `POST /debug-payload` | Sem entrada no Portal. | Admin-only via JWT (sem N8N). |
| `contas-pagar-n8n-sync` (função separada) | Não montada no portal. | Função isolada criada hoje exclusivamente para o pipeline N8N→ERP. Zero exposição pública. |

## Conclusão

**Integrador externo que consome o Portal ERP:**
- Usa apenas API Key emitida pelo Portal (tabela `api_keys`), nunca `N8N_API_KEY`.
- Nunca depende de workflow N8N estar ativo para CRUD/consulta/pagamento funcionarem.
- Pode operar 100% sem o N8N existir.

**N8N é exclusivamente um produtor interno** que alimenta `contas_pagar` via rotas administrativas (`/bulk-sync`, `/sync*`, e agora a função isolada `contas-pagar-n8n-sync`). Esse pipeline é invisível ao Portal e ao integrador.

**Nenhuma ação corretiva necessária.** A separação já está limpa: APIs públicas do Portal e canal N8N de ingestão são caminhos independentes que apenas convergem na mesma tabela final.

## Recomendação leve (opcional, não implementada agora)

Se quiser blindagem extra de documentação, posso adicionar nota explícita no `ApiDocumentation.tsx` (seção "Autenticação"): *"A API Key emitida pelo Portal é a única credencial válida para integradores externos. Endpoints internos do pipeline N8N usam credencial separada e não estão listados nesta documentação."* — isso é puramente cosmético e só seria feito se você pedir.


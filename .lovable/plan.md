

# Análise Completa: Impacto em Produção + Lacunas Frontend + Nota de Conectividade

## 1. Impacto em Produção das Alterações Recentes

### Alterações Seguras (sem risco)
- **Perfis de acesso** (`erp_portal_access_profiles`, `erp_portal_access_modules`, `erp_portal_user_profiles`): Tabelas novas com RLS. Não afetam funcionalidades existentes.
- **Coluna `access_profile_id` em `erp_api_keys`**: FK nullable — chaves existentes continuam com acesso completo (backwards compatible).
- **Aba "Configurações"** visível apenas para admins — não altera fluxo de não-admins.
- **Bandeiras API**: Adição de `cTipo` ao mapper — aditivo, não quebra clientes existentes.
- **CP/CR expansão de campos no frontend**: Apenas exibe dados já existentes no DB. Campos opcionais com defaults.

### Risco Baixo (verificar)
- **Filtro `accessProfileModules` no `ApiDocumentation`**: Se um perfil incorreto for vinculado a um usuário, ele pode deixar de ver endpoints. Mas default sem perfil = acesso total. **Risco mitigado.**
- **`useCurrentUserProfile` + `useAccessProfileForKey`**: Hooks novos que consultam tabelas novas. Se as tabelas estão vazias, retornam `null` → sem filtro aplicado. **OK.**

**Veredicto**: As alterações são **seguras para produção**. Todas são aditivas e backwards-compatible.

---

## 2. Lacunas do Frontend Identificadas

### A. Portal de Integração ERP (`IntegracaoERP.tsx`)

| Lacuna | Severidade | Detalhes |
|---|---|---|
| **Sem botão "Voltar"** | Média | Não há navegação de retorno ao dashboard |
| **Documentação expõe URL real do Supabase** | Alta | `BASE_URL` hardcoded com URL completa do projeto na linha 19 do `ApiDocumentation.tsx` — viola diretriz de abstração |
| **Fornecedores no módulo "Geral"** | Média | No plano aprovado deveriam ter migrado para "Cadastros", mas ainda estão em `geral` (linhas 488-489) |
| **Resposta doc. vs. real diverge em CP** | Média | Doc mostra `{ "id": "uuid", "fornecedor_nome": "..." }` no `/query`, mas backend retorna `{ "data": [...], "pagination": {...}, "meta": {...} }` |
| **Doc de `/registrar-pagamento` diverge** | Média | Doc pede `{ "id": "uuid-titulo" }`, backend espera `{ "conta_pagar_id": "uuid" }` |
| **Sem doc de erros estruturados** | Baixa | Endpoints retornam `{ "error": "campo_obrigatorio", "message": "..." }` mas doc não lista esses códigos de erro |
| **Changelog desatualizado** | Baixa | Último entry é v1.4.0 (2026-03-23) mas muitas APIs foram adicionadas depois |

### B. Contas a Pagar — Gaps remanescentes

| Lacuna | Onde |
|---|---|
| Form CP ainda sem campos tributários no drawer de criação | `ContasPagarGestao.tsx` |
| 12 campos fiscais (`retem_*`, `valor_*`) adicionados ao detalhe mas não editáveis | `ContaPagarDetalhe.tsx` |

### C. Contas a Receber — Gaps remanescentes

| Lacuna | Onde |
|---|---|
| Endpoints CR existem no backend (`/lancar-recebimento`, `/cancelar-recebimento`, `/conciliar`, `/desconciliar`, `/cancelar`) mas **não estão documentados no portal** | `ApiDocumentation.tsx` — faltam 5 endpoints |
| CR detail drawer não carrega dados de conciliação | `ContasAReceber.tsx` |

### D. Documentação API — Discrepâncias Técnicas

| Endpoint Documentado | Problema |
|---|---|
| CP `/registrar-pagamento` | Body doc: `{ "id": ... }` — Backend espera: `{ "conta_pagar_id": ... }` |
| CP `/query` response | Doc: formato flat — Real: `{ data, pagination, meta }` |
| CP `/cancelar` response | Doc: `{ "cancelados": 2 }` — Real: `{ "success": true, "cancelados": 2, "ids": [...] }` |
| CP `/upsert` | Doc não menciona campo obrigatório `empresa_id` no onConflict |
| CP `/listar` | Doc omite filtros disponíveis: `filtrar_por_emissao_de/ate`, `filtrar_conta_corrente`, `filtrar_por_cpf_cnpj`, `filtrar_por_vendedor`, `exibir_obs` |

---

## 3. Plano de Correção

### Arquivo: `src/pages/IntegracaoERP.tsx`
- Adicionar botão "Voltar" no header (← ArrowLeft + `useNavigate(-1)`)

### Arquivo: `src/components/erp/ApiDocumentation.tsx`
1. **Mover Fornecedores** de `geral` para `cadastros` (conforme plano aprovado)
2. **Corrigir exemplos de body/response** nos endpoints divergentes:
   - `/registrar-pagamento`: `id` → `conta_pagar_id`
   - `/query` response: adicionar `pagination` e `meta`
   - `/cancelar` response: adicionar `success` e `ids`
   - `/upsert`: documentar `empresa_id` como obrigatório
3. **Adicionar 5 endpoints CR faltantes**: `lancar-recebimento`, `cancelar-recebimento`, `conciliar`, `desconciliar`, `cancelar`
4. **Adicionar filtros faltantes** na doc de `/listar` CP
5. **Atualizar changelog** com v1.5.0

### Sem alterações no backend
Todas as edge functions estão implementadas e funcional. Os problemas são de **documentação no frontend**.

---

## 4. Nota de Conectividade (0-100)

### Avaliação por critério:

| Critério | Nota | Observação |
|---|---|---|
| **Auth bem documentada** | 9/10 | API Key + JWT + cURL exemplos. Claro. |
| **Health checks** | 10/10 | Todos os endpoints têm `/status`. |
| **Início Rápido** | 8/10 | 4 passos claros + ordem de integração. |
| **Exemplos de request/response** | 6/10 | Presentes mas com divergências (body fields incorretos). Dev vai bater cabeça. |
| **Tratamento de erros** | 5/10 | Doc lista apenas 5 HTTP codes genéricos. Backend retorna erros estruturados que não estão documentados. |
| **Paginação** | 7/10 | 3 padrões documentados, mas confuso qual API usa qual. |
| **Completude** | 6/10 | 5 endpoints CR existentes não documentados. Filtros omitidos. |
| **Postman collection** | 9/10 | Botão "Run in Postman" + Excel export. |
| **Webhooks** | 8/10 | HMAC doc + catálogo de eventos. |
| **Curl generator** | 9/10 | Em cada endpoint. |

### Nota Final: **72/100**

**Justificativa**: Um desenvolvedor experiente consegue integrar, mas vai enfrentar fricção em:
- Body fields divergentes (vai receber 400 e precisar investigar)
- Endpoints de CR não documentados (vai achar que não existem)
- Filtros não documentados (vai perder funcionalidade)
- Padrões de paginação confusos (3 padrões diferentes)

Com as correções propostas, a nota sobe para **88-90/100**.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/pages/IntegracaoERP.tsx` | Botão "Voltar" |
| `src/components/erp/ApiDocumentation.tsx` | Mover Fornecedores, corrigir docs divergentes, adicionar 5 endpoints CR, atualizar changelog |


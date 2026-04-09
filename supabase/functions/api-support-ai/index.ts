import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const API_DOCS_CONTEXT = `
## APIs Disponíveis no Portal ERP (Huggs) — Documentação Completa

Base URL: https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1

---

### 1. CONTAS A PAGAR (contas-pagar-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /status | Health check |
| POST | /incluir | Incluir título CP |
| PUT | /alterar | Alterar título |
| DELETE | /excluir | Excluir (inativar) título |
| POST | /upsert | Upsert unitário |
| POST | /upsert-lote | Upsert em lote (max 500) |
| POST | /lancar-pagamento | Lançar baixa de pagamento |
| POST | /cancelar-pagamento | Cancelar baixa |
| GET | /listar | Listagem paginada |
| GET | /consultar | Consultar por ID/código integração |
| POST | /sync | Sync legado (N8N) |
| POST | /bulk-sync | Sync em massa |
| POST | /sync-chunk | Sync chunk |
| POST | /sync-complete | Finalizar sync |
| GET | /chunks-progress | Progresso chunks |
| GET | /last-sync | Última sync (admin JWT) |
| GET | /stats | Estatísticas |

**Schema /incluir (Zod .strict()):**
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório, max 100, seu ID externo)",
  "codigo_cliente_fornecedor": "number (obrigatório, código do fornecedor)",
  "data_vencimento": "string (obrigatório, DD/MM/YYYY ou YYYY-MM-DD)",
  "valor_documento": "number (obrigatório, positivo)",
  "codigo_categoria": "string (obrigatório, ex: '2.04.01')",
  "data_previsao": "string (obrigatório)",
  "id_conta_corrente": "number (obrigatório)",
  "observacao": "string (opcional, max 2000)",
  "numero_documento": "string (opcional)",
  "numero_pedido": "string (opcional)",
  "codigo_projeto": "string (opcional)"
}
\`\`\`
⚠️ Campos extras são REJEITADOS (Zod .strict()).

**Schema /lancar-pagamento:**
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório)",
  "valor": "number (obrigatório, positivo)",
  "data": "string (opcional)",
  "desconto": "number (opcional, min 0)",
  "juros": "number (opcional, min 0)",
  "multa": "number (opcional, min 0)",
  "observacao": "string (opcional, max 2000)"
}
\`\`\`

**Exemplo Incluir CP — Sucesso:**
\`\`\`
POST /contas-pagar-api/incluir
x-api-key: SUA_CHAVE
Content-Type: application/json

{
  "codigo_lancamento_integracao": "CP-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}

→ 201:
{
  "codigo_lancamento_huggs": null,
  "codigo_lancamento_integracao": "CP-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
\`\`\`

**Exemplo Duplicado:**
\`\`\`
→ 409:
{
  "codigo_lancamento_integracao": "CP-001",
  "codigo_status": "3",
  "descricao_status": "Registro já existe. Use /upsert ou /alterar."
}
\`\`\`

---

### 2. CONTAS A RECEBER (contas-receber-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /status | Health check |
| GET | /consultar | Consultar por ID/código integração/código Huggs |
| GET | /listar | Listagem paginada (max 500/página) |
| POST | /incluir | Incluir título CR |
| PUT | /alterar | Alterar título |
| DELETE | /excluir | Excluir título |
| POST | /upsert | Upsert unitário |
| POST | /upsert-lote | Upsert em lote (max 500) |
| POST | /lancar-recebimento | Lançar recebimento (baixa) |
| POST | /cancelar-recebimento | Cancelar recebimento |
| POST | /conciliar | Conciliar título |
| POST | /desconciliar | Desconciliar título |
| POST | /cancelar | Cancelar título |

**Schema /incluir (Zod .strict()):**
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório, max 100)",
  "codigo_cliente_fornecedor": "string|number (opcional)",
  "data_vencimento": "string (opcional, DD/MM/YYYY ou YYYY-MM-DD)",
  "valor_documento": "number (opcional)",
  "codigo_categoria": "string (opcional, max 100)",
  "data_previsao": "string (opcional)",
  "empresa_id": "string|number (opcional)",
  "id_conta_corrente": "number (opcional)",
  "observacao": "string (opcional, max 2000)"
}
\`\`\`

**Schema /lancar-recebimento:**
\`\`\`json
{
  "codigo_lancamento_integracao": "string (obrigatório)",
  "valor": "number (obrigatório, positivo)",
  "data": "string (opcional)",
  "desconto": "number (opcional, min 0)",
  "juros": "number (opcional, min 0)",
  "multa": "number (opcional, min 0)",
  "observacao": "string (opcional, max 2000)"
}
\`\`\`

**Campos Tributários (Impostos Retidos):**
valor_pis, retem_pis, valor_cofins, retem_cofins, valor_csll, retem_csll, valor_ir, retem_ir, valor_iss, retem_iss, valor_inss, retem_inss

**Campos Boleto:**
boleto_gerado, boleto_numero, boleto_numero_bancario, boleto_per_juros, boleto_per_multa

**Campos Rateio:**
rateio_categorias (JSONB), rateio_departamentos (JSONB)

**Filtros GET /listar:**
pagina, registros_por_pagina, apenas_importado_api, filtrar_por_status, filtrar_por_data_de, filtrar_por_data_ate, filtrar_conta_corrente, filtrar_cliente, filtrar_por_projeto, filtrar_por_vendedor, filtrar_por_cpf_cnpj, ordenar_por, ordem_descrescente

**Exemplo Recebimento — Sucesso:**
\`\`\`
POST /contas-receber-api/lancar-recebimento
{
  "codigo_lancamento_integracao": "CR-001",
  "valor": 100.20,
  "desconto": 0, "juros": 0, "multa": 0,
  "data": "21/03/2026",
  "observacao": "Baixa via API"
}
→ 200:
{
  "codigo_lancamento_integracao": "CR-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Recebimento registrado com sucesso!"
}
\`\`\`

---

### 3. CLIENTES (clientes-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | Incluir cliente |
| POST | /alterar | Alterar cliente |
| POST | /excluir | Excluir cliente |
| GET | /listar | Listagem paginada |
| POST | /upsert-lote | Upsert em lote (max 500) |
| POST | /sync | Sincronização |

**Campos principais:** codigo_cliente_integracao, nome_fantasia, razao_social, cnpj_cpf, email, telefone, cidade, estado, cep, endereco, bairro

---

### 4. CONTAS CORRENTES (contas-correntes-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | / | Listar contas correntes |
| GET | /resumo | Resumo financeiro (saldos) |
| POST | /incluir | Incluir conta corrente |
| PUT | /alterar | Alterar conta corrente |
| DELETE | /excluir | Excluir conta corrente |
| POST | /upsert | Upsert unitário |
| POST | /upsert-lote | Upsert em lote |

**Campos:** descricao, tipo (CC/PP/CX/CI), banco, agencia, conta, saldo_inicial, empresa_id

---

### 5. LANÇAMENTOS CC (lancamentos-cc-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | / | Listar lançamentos |
| POST | /incluir | Incluir lançamento |
| PUT | /alterar | Alterar lançamento |
| DELETE | /excluir | Excluir lançamento |
| GET | /extrato | Extrato de conta corrente (saldo + movimentos) |

---

### 6. CATEGORIAS (categorias-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | IncluirCategoria |
| POST | /incluir-grupo | IncluirGrupoCategoria |
| POST | /alterar | AlterarCategoria |
| POST | /alterar-grupo | AlterarGrupoCategoria |
| POST | /consultar | ConsultarCategoria |
| POST | /listar | ListarCategorias (paginado) |
| GET | /status | Health check |

**Schema /incluir:**
\`\`\`json
{
  "descricao": "Serviços Terceiros",
  "tipo_categoria": "D",
  "natureza": "Despesas com serviços",
  "codigo_dre": "3.01.01",
  "categoria_superior": ""
}
\`\`\`

**Schema /listar:**
\`\`\`json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "filtrar_apenas_ativo": "S",
  "filtrar_por_tipo": "D"
}
\`\`\`
Tipos: "R" = receita, "D" = despesa

**Resposta /consultar:**
\`\`\`json
{
  "categoria_cadastro": {
    "codigo": "CAT-001",
    "descricao": "Serviços Terceiros",
    "tipo_categoria": "D",
    "conta_inativa": "N",
    "conta_despesa": "S",
    "conta_receita": "N",
    "totalizadora": "N",
    "natureza": "Despesas com serviços",
    "codigo_dre": "3.01.01",
    "categoria_superior": "",
    "dadosDRE": {
      "codigoDRE": "3.01.01",
      "descricaoDRE": "",
      "naoExibirDRE": "N",
      "nivelDRE": 0,
      "sinalDRE": "",
      "totalizaDRE": "N"
    }
  }
}
\`\`\`

---

### 7. DRE CADASTRO (dre-cadastro-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /listar | ListarCadastroDRE |
| GET | /status | Health check |

**Schema /listar:**
\`\`\`json
{ "apenasContasAtivas": "S" }
\`\`\`

**Resposta:**
\`\`\`json
{
  "totalRegistros": 25,
  "dreLista": [
    {
      "codigoDRE": "4.1",
      "descricaoDRE": "Receita Bruta",
      "naoExibirDRE": "N",
      "nivelDRE": 2,
      "sinalDRE": "+",
      "totalizaDRE": "N"
    }
  ]
}
\`\`\`

---

### 8. ORÇAMENTO DE CAIXA (orcamentos-caixa-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarOrcamentos (previsto x realizado) |
| POST | /incluir | Cadastrar orçamento previsto |
| POST | /incluir-lote | Upsert em lote (max 500) |

**GET /listar — Query Params:**
- nAno (integer, obrigatório) — Ano
- nMes (integer, obrigatório) — Mês (1-12)

**Resposta /listar:**
\`\`\`json
{
  "nAno": 2026,
  "nMes": 3,
  "ListaOrcamentos": [
    {
      "cCodCateg": "2.04.01",
      "cDesCateg": "Serviços Terceiros",
      "nValorPrevisto": 5000.00,
      "nValorRealizado": 3200.50
    }
  ]
}
\`\`\`

**Schema /incluir:**
\`\`\`json
{
  "nAno": 2026,
  "nMes": 3,
  "cCodCateg": "2.04.01",
  "cDesCateg": "Serviços Terceiros",
  "nValorPrevisto": 5000.00
}
\`\`\`

---

### 9. PARCELAS / CONDIÇÕES DE PAGAMENTO (parcelas-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | IncluirParcela |
| POST | /listar | ListarParcelas (paginado) |
| GET | /status | Health check |

**Schema /incluir:**
\`\`\`json
{ "cParcela": "30/60/90" }
\`\`\`

**Resposta /listar:**
\`\`\`json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 3,
  "total_de_registros": 3,
  "cadastros": [
    { "nCodigo": "001", "cDescricao": "À Vista", "nParcelas": 1 }
  ]
}
\`\`\`

---

### 10. FINALIDADES DE TRANSFERÊNCIA (finalidades-transferencia-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /consultar?codigo=01 | ConsultarFinalTransf |
| GET | /listar?pagina=1 | ListarFinalTransf (paginado) |
| GET | /status | Health check |

**Resposta /consultar:**
\`\`\`json
{ "banco": "", "codigo": "01", "descricao": "Crédito em Conta" }
\`\`\`

---

### 11. TIPOS DE ENTREGA (tipos-entrega-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | IncluirTipoEntrega |
| POST | /alterar | AlterarTipoEntrega |
| POST | /consultar | ConsultarTipoEntrega |
| POST | /excluir | ExcluirTipoEntrega |
| POST | /listar | ListarTipoEntrega |
| GET | /status | Health check |

**Schema /incluir:**
\`\`\`json
{
  "nCodTransp": 0,
  "cCodIntEntrega": "",
  "cDescricao": "Entrega Normal",
  "cInativo": "N"
}
\`\`\`

**Resposta /listar:**
\`\`\`json
{
  "nPagina": 1,
  "nTotalPaginas": 1,
  "nRegistros": 2,
  "nTotalRegistros": 2,
  "CadTiposEntrega": [
    { "nCodTransp": 0, "nCodEntrega": 1, "cCodIntEntrega": "", "cDescricao": "Normal", "cInativo": "N" }
  ]
}
\`\`\`

---

### 12. BOLETOS (boletos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /gerar | Gerar boleto |
| GET | /obter | Obter boleto por ID |
| POST | /cancelar | Cancelar boleto |
| POST | /prorrogar | Prorrogar vencimento |
| GET | /listar | Listar boletos |

---

### 13. ANEXOS (anexos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | Incluir anexo (base64) |
| GET | /consultar | Consultar anexos de um título |
| GET | /obter | Download de anexo |
| DELETE | /excluir | Excluir anexo |

---

### 14. WEBHOOK SUBSCRIPTIONS

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | Criar assinatura webhook |
| PUT | /alterar | Alterar assinatura |
| DELETE | /excluir | Excluir assinatura |
| POST | /testar | Testar webhook (dispara evento de teste) |

**Eventos disponíveis:**
- conta_pagar.incluida, conta_pagar.alterada, conta_pagar.excluida, conta_pagar.pagamento
- conta_receber.incluida, conta_receber.recebimento, conta_receber.alterada
- cliente.incluido, cliente.alterado

**Formato do webhook:**
\`\`\`json
{
  "event_type": "conta_pagar.incluida",
  "timestamp": "2026-04-09T10:00:00Z",
  "data": { "id": "uuid", "codigo_lancamento_integracao": "CP-001" }
}
\`\`\`

---

### 15. EXPORT DE PAGAMENTOS (contas-pagar-export-api / erp-export-payment)

**Fluxo SAP/TOTVS completo:**
1. GET /pending — Lista títulos pendentes de exportação
2. GET /paid — Lista títulos pagos pendentes de exportação
3. POST /confirm — Confirma exportação (marca como exportado)

**Fluxo detalhado:**
- Provisão: Título incluído → exporta dados para ERP → confirma
- Baixa: Pagamento lançado → exporta baixa para ERP → confirma

---

### 16. EMPRESAS (empresas-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /consultar | ConsultarEmpresa por ID |
| GET | /listar | ListarEmpresas (todas do tenant) |

---

### 17. PROJETOS (projetos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | IncluirProjeto |
| POST | /alterar | AlterarProjeto |
| POST | /consultar | ConsultarProjeto |
| POST | /excluir | ExcluirProjeto |
| POST | /listar | ListarProjetos (paginado) |
| POST | /upsert | UpsertProjeto |

---

### 18. DEPARTAMENTOS (departamentos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /incluir | IncluirDepartamento |
| POST | /alterar | AlterarDepartamento |
| POST | /consultar | ConsultarDepartamento |
| POST | /excluir | ExcluirDepartamento |
| POST | /listar | ListarDepartamentos (paginado) |

---

### 19. BANCOS (bancos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /consultar | ConsultarBanco por código COMPE ou ISPB |
| GET | /listar | ListarBancos (todos ativos) |

---

### 20. BANDEIRAS DE CARTÃO (bandeiras-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarBandeiras (Visa, Master, Elo, etc.) |

---

### 21. CNAE (cnae-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarCNAE (paginado, filtro por código/descrição) |

---

### 22. CIDADES (cidades-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /pesquisar | PesquisarCidades (filtro por nome/UF/IBGE) |

---

### 23. PAÍSES (paises-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarPaises |

---

### 24. ORIGENS (origens-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarOrigem (origens de lançamento) |

---

### 25. TIPOS DE DOCUMENTO (tipos-documento-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /consultar | ConsultarTipoDocumento |
| GET | /pesquisar | PesquisarTipoDocumento (filtro) |

---

### 26. TIPOS DE ATIVIDADE (tipos-atividade-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarTiposAtividade |

---

### 27. TIPOS DE ANEXO (tipos-anexo-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarTiposAnexo |

---

### 28. RESUMO FINANCEIRO (resumo-financeiro-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /obter | ObterResumoFinancas |

**Filtros:** empresa_id, data_inicio, data_fim, conta_corrente_id
**Retorna:** total_receitas, total_despesas, saldo, contas_vencidas, contas_a_vencer

---

### 29. MOVIMENTOS FINANCEIROS (movimentos-financeiros-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarMovimentos (unificado CP/CR/CC) |

**Filtros:** tipo (CP/CR/CC), data_inicio, data_fim, categoria, empresa_id, conta_corrente_id, pagina, registros_por_pagina

---

### 30. PESQUISAR LANÇAMENTOS (pesquisar-lancamentos-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /pesquisar | PesquisarLancamentos (filtros avançados) |

**Filtros:** texto (busca em descrição/observação), tipo, status, data_de, data_ate, valor_min, valor_max, fornecedor, categoria

---

### 31. EXTRATO CC (extrato-cc-api)

**Endpoints:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /listar | ListarExtrato (saldo anterior + movimentos + saldo final) |

**Filtros:** conta_corrente_id (obrigatório), data_inicio, data_fim

---

## AUTENTICAÇÃO

Todas as APIs aceitam dois métodos:
1. **API Key** via header \`x-api-key: SUA_CHAVE\` (para ERP/server-to-server)
2. **JWT Bearer** via header \`Authorization: Bearer <token>\` (para usuários autenticados)

### Passo a passo:
1. Acesse o Portal ERP → menu Configurações → APIs
2. Gere uma API Key (ela é mostrada apenas uma vez)
3. Adicione o header \`x-api-key: SUA_CHAVE\` em TODAS as requisições
4. Para JWT: faça login via Supabase Auth, use o access_token no header Authorization

**Exemplo curl com API Key:**
\`\`\`bash
curl -X GET "BASE_URL/contas-pagar-api/listar?pagina=1&registros_por_pagina=20" \\
  -H "x-api-key: SUA_CHAVE" \\
  -H "Content-Type: application/json"
\`\`\`

**Exemplo JavaScript:**
\`\`\`javascript
const response = await fetch('BASE_URL/contas-pagar-api/listar?pagina=1', {
  headers: { 'x-api-key': 'SUA_CHAVE', 'Content-Type': 'application/json' }
});
const data = await response.json();
\`\`\`

**Exemplo Python:**
\`\`\`python
import requests
r = requests.get('BASE_URL/contas-pagar-api/listar',
  params={'pagina': 1, 'registros_por_pagina': 20},
  headers={'x-api-key': 'SUA_CHAVE'})
data = r.json()
\`\`\`

---

## CÓDIGOS DE ERRO DETALHADOS

| Status | Código | Descrição | Ação Recomendada |
|--------|--------|-----------|------------------|
| 400 | — | Payload inválido (Zod validation) | Verifique campos obrigatórios e tipos |
| 401 | — | API Key inválida ou JWT expirado | Gere nova chave ou faça novo login |
| 403 | — | Sem permissão para esta operação | Verifique permissões da API Key |
| 404 | — | Registro não encontrado | Verifique o ID ou codigo_lancamento_integracao |
| 409 | 3 | Registro duplicado | Use /upsert em vez de /incluir |
| 413 | — | Lote excede 500 registros | Divida em lotes menores |
| 429 | — | Rate limit excedido | Aguarde header Retry-After |
| 500 | — | Erro interno do servidor | Tente novamente; se persistir, contate suporte |

**Exemplo erro Zod (.strict()):**
\`\`\`json
→ 400:
{
  "error": "Payload inválido",
  "details": { "": ["Unrecognized key(s) in object: 'campo_invalido'"] }
}
\`\`\`

---

## RATE LIMITING

- Contas a Pagar: 60 req/min por empresa/usuário
- Contas a Receber: 60 req/min por empresa/usuário
- Geral operacional: 100 req/min
- APIs de consulta (bancos, categorias, etc.): 120 req/min
- Header \`Retry-After\` indica quando tentar novamente

---

## WEBHOOK EVENTS

Eventos disparados automaticamente:
- \`conta_pagar.incluida\` — Novo título CP criado
- \`conta_pagar.alterada\` — Título CP alterado
- \`conta_pagar.excluida\` — Título CP inativado
- \`conta_pagar.pagamento\` — Baixa registrada
- \`conta_receber.incluida\` — Novo título CR criado
- \`conta_receber.alterada\` — Título CR alterado
- \`conta_receber.recebimento\` — Recebimento registrado
- \`cliente.incluido\` — Cliente criado
- \`cliente.alterado\` — Cliente alterado

**Formato:**
\`\`\`json
{
  "event_type": "conta_pagar.incluida",
  "timestamp": "2026-04-09T10:00:00Z",
  "data": { "id": "uuid", "codigo_lancamento_integracao": "CP-001" }
}
\`\`\`

---

## FORMATO DE DATAS
Aceita ISO 8601 (YYYY-MM-DD) e formato brasileiro (DD/MM/YYYY).

## PAGINAÇÃO
Padrão Huggs: \`{ pagina: 1, registros_por_pagina: 50 }\`
Padrão REST: query params \`?pagina=1&registros_por_pagina=50\`
Máximo: 500 registros por página.

---

## FLUXOS DE INTEGRAÇÃO COMPLETOS

### Fluxo 1: Primeira Integração
1. Acesse o Portal ERP → Aba "Início" → Siga o Onboarding Wizard
2. Gere sua API Key em Configurações → APIs
3. Teste no Sandbox (aba "Tester") com payload de exemplo
4. Confirme resposta 200/201
5. Implemente no seu sistema usando os SDKs (JS/Python) disponíveis no portal

### Fluxo 2: Sincronização de Cadastros (ordem recomendada)
1. GET /empresas-api/listar → Obter empresa_id
2. GET /bancos-api/listar → Dados bancários
3. POST /categorias-api/listar → Categorias de receita/despesa
4. GET /contas-correntes-api/ → Contas correntes existentes
5. POST /clientes-api/upsert-lote → Sincronizar base de clientes
6. POST /departamentos-api/listar → Departamentos
7. POST /projetos-api/listar → Projetos

### Fluxo 3: Contas a Pagar End-to-End
1. POST /contas-pagar-api/incluir → Criar título
2. PUT /contas-pagar-api/alterar → Ajustar se necessário
3. POST /contas-pagar-api/lancar-pagamento → Registrar baixa
4. GET /contas-pagar-export-api/paid → Verificar pendentes de export
5. POST /contas-pagar-export-api/confirm → Confirmar exportação ERP

### Fluxo 4: Contas a Receber End-to-End
1. POST /contas-receber-api/incluir → Criar título
2. POST /contas-receber-api/lancar-recebimento → Registrar recebimento
3. POST /contas-receber-api/conciliar → Conciliar no banco
4. GET /contas-receber-api/listar → Verificar status atualizado

### Fluxo 5: Consultas Financeiras
1. GET /resumo-financeiro-api/obter → Visão geral (receitas x despesas)
2. GET /extrato-cc-api/listar → Extrato detalhado por conta corrente
3. POST /dre-cadastro-api/listar → Estrutura do DRE
4. GET /orcamentos-caixa-api/listar → Previsto x realizado
5. GET /movimentos-financeiros-api/listar → Movimentos consolidados

### Fluxo 6: Upsert em Lote (alta performance)
1. Divida registros em lotes de 500
2. POST /contas-pagar-api/upsert-lote com \`{ "lote": 1, "conta_pagar_cadastro": [...] }\`
3. Aguarde resposta antes do próximo lote
4. Trate erros parciais (alguns registros podem falhar individualmente)
`;

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT - any authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { message_id, user_message, endpoint_path, mode, conversation_history } = body;

    if (mode === 'admin') {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!user_message) {
      return new Response(JSON.stringify({ error: 'user_message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `Você é o assistente técnico mais avançado do Portal de APIs ERP do sistema BiMaster/Union CRM (Portal Huggs).
Você tem conhecimento COMPLETO e DETALHADO de TODAS as 31+ APIs, schemas Zod, autenticação, webhooks, rate limits, códigos de erro e fluxos de integração.
Responda SEMPRE em português brasileiro, de forma técnica mas acessível a desenvolvedores.
Use exemplos de código (curl, JavaScript, Python) quando relevante.
Seja direto, preciso e completo. Formate a resposta em Markdown.

${API_DOCS_CONTEXT}

O endpoint em discussão é: ${endpoint_path || 'geral'}

Regras:
- Não invente endpoints que não existem na documentação acima
- Sugira soluções práticas com exemplos de código completos
- Se não souber a resposta, diga claramente e sugira contatar o admin
- Para erros, mostre o payload correto e headers necessários
- Inclua exemplos de tratamento de erro
- Quando relevante, mencione rate limits e boas práticas
- Se a dúvida for sobre campos obrigatórios, liste o schema Zod completo
- Para webhooks, explique o formato do evento e como configurar
- Para fluxos complexos, indique a sequência correta de APIs a chamar
- Sempre indique quando .strict() rejeita campos extras`;

    // Build messages array with conversation history
    const messages: Array<{role: string; content: string}> = [
      { role: 'system', content: systemPrompt },
    ];

    if (Array.isArray(conversation_history) && conversation_history.length > 0) {
      const recentHistory = conversation_history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: user_message });

    // Try primary model, fallback to Gemini on failure
    let aiData: any = null;
    const models = ['openai/gpt-5.2', 'google/gemini-2.5-flash'];
    
    for (const model of models) {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          ...(model === 'openai/gpt-5.2' ? { reasoning: { effort: 'high' } } : {}),
        }),
      });

      if (aiResponse.ok) {
        aiData = await aiResponse.json();
        break;
      }

      const errorText = await aiResponse.text();
      console.error(`AI model ${model} error:`, aiResponse.status, errorText);

      // For client errors (402), don't retry with fallback
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For 429/500, try fallback model
      if (model === models[models.length - 1]) {
        return new Response(JSON.stringify({ error: 'Todos os modelos de IA indisponíveis. Tente novamente em alguns segundos.' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Falling back to ${models[models.indexOf(model) + 1]}...`);
    }

    if (!aiData) {
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const suggestion = aiData.choices?.[0]?.message?.content || 'Sem resposta gerada.';

    if (message_id && mode === 'admin') {
      await supabase
        .from('api_support_messages')
        .update({ ai_suggested_reply: suggestion })
        .eq('id', message_id);
    }

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('api-support-ai error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// api-sandbox — Dry-run proxy returning responses matching the documented API formats
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateJWT, AuthError } from "../_shared/auth.ts";

// ═══════════════════════════════════════
// MOCK DATA PER API — matches ApiDocumentation.tsx
// ═══════════════════════════════════════

function mockContasPagar(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "query": return { data: [{ id: "sandbox-uuid-001", fornecedor_nome: "[SANDBOX] Fornecedor Exemplo", valor_original: 1500, status: "pendente", data_vencimento: "2026-04-15" }], pagination: { total: 2, offset: 0, limit: 100 }, meta: { filters_applied: {} } };
    case "update": return { success: true, message: "[SANDBOX] Título atualizado", updated_fields: ["data_vencimento", "valor_original"] };
    case "cancelar": return { success: true, cancelados: 1, ids: ["sandbox-uuid-001"], message: "[SANDBOX] 1 título(s) cancelado(s)" };
    case "registrar-pagamento": return { success: true, pagamento_id: "sandbox-pag-001", novo_status: "pago", valor_aberto: 0 };
    case "consultar": return { conta_pagar_cadastro: { id: "sandbox-uuid-001", codigo_lancamento_integracao: "SANDBOX-INT-001", valor_original: 100, status: "pendente", fornecedor_nome: "[SANDBOX] Fornecedor" } };
    case "incluir": return { codigo_lancamento_huggs: null, codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-INT-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro incluído com sucesso!" };
    case "alterar": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-INT-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro alterado com sucesso!" };
    case "excluir": return { codigo_lancamento_integracao: "SANDBOX-INT-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro excluído com sucesso!" };
    case "upsert": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-INT-001", codigo_status: "0", descricao_status: "[SANDBOX] Upsert realizado com sucesso!" };
    case "upsert-lote": return { lote: (b as any)?.lote || 1, codigo_status: "0", descricao_status: "[SANDBOX] 1 processado(s), 0 erro(s)" };
    case "lancar-pagamento": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-INT-001", codigo_baixa: "sandbox-baixa-001", liquidado: "S", valor_baixado: (b as any)?.valor || 100.20, codigo_status: "0", descricao_status: "[SANDBOX] Pagamento registrado com sucesso!" };
    case "cancelar-pagamento": return { codigo_baixa: "sandbox-baixa-001", codigo_status: "0", descricao_status: "[SANDBOX] Pagamento cancelado com sucesso!" };
    case "listar": return { pagina: 1, total_de_paginas: 5, registros: 20, total_de_registros: 100, conta_pagar_cadastro: [{ id: "sandbox-001", codigo_lancamento_integracao: "SANDBOX-CP-001", fornecedor: "[SANDBOX] Fornecedor", valor_documento: 1500, status: "pendente" }] };
    default: return null;
  }
}

function mockContasReceber(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "consultar": return { conta_receber_cadastro: { id: "sandbox-uuid-001", codigo_lancamento_integracao: "SANDBOX-CR-001", valor_original: 100 } };
    case "incluir": return { codigo_lancamento_huggs: null, codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-CR-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro incluído com sucesso!" };
    case "alterar": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-CR-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro alterado com sucesso!" };
    case "excluir": return { codigo_lancamento_integracao: "SANDBOX-CR-001", codigo_status: "0", descricao_status: "[SANDBOX] Cadastro excluído com sucesso!" };
    case "upsert": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-CR-001", codigo_status: "0", descricao_status: "[SANDBOX] Upsert realizado com sucesso!" };
    case "upsert-lote": return { lote: (b as any)?.lote || 1, codigo_status: "0", descricao_status: "[SANDBOX] 1 processado(s), 0 erro(s)" };
    case "lancar-recebimento": return { codigo_lancamento_integracao: (b as any)?.codigo_lancamento_integracao || "SANDBOX-CR-001", liquidado: "S", valor_baixado: (b as any)?.valor || 100.20, codigo_status: "0", descricao_status: "[SANDBOX] Recebimento registrado com sucesso!" };
    case "cancelar-recebimento": return { codigo_baixa: 0, codigo_status: "0", descricao_status: "[SANDBOX] Recebimento cancelado com sucesso!" };
    case "conciliar": return { codigo_baixa: 0, codigo_status: "0", descricao_status: "[SANDBOX] Conciliação realizada com sucesso!" };
    case "desconciliar": return { codigo_baixa: 0, codigo_status: "0", descricao_status: "[SANDBOX] Desconciliação realizada com sucesso!" };
    case "cancelar": return { chave_lancamento: 0, codigo_status: "0", descricao_status: "[SANDBOX] Título cancelado com sucesso!" };
    case "listar": return { pagina: 1, total_de_paginas: 5, registros: 20, total_de_registros: 100, conta_receber_cadastro: [{ id: "sandbox-001", codigo_lancamento_integracao: "SANDBOX-CR-001", valor_documento: 1500, status: "pendente" }] };
    default: return null;
  }
}

function mockContasCorrentes(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "": case "listar": return { pagina: 1, total_de_paginas: 3, registros: 100, total_de_registros: 250, ListarContasCorrentes: [{ nCodCC: 427619317, cCodCCInt: "SANDBOX-CC001", descricao: "[SANDBOX] Conta Itaú", tipo: "CC", saldo: 15000 }] };
    case "resumo": return { contas: [{ nCodCC: 427619317, descricao: "[SANDBOX] Conta Itaú", saldo: 15000 }] };
    case "consultar": return { fin_conta_corrente_cadastro: { nCodCC: 427619317, cCodCCInt: "SANDBOX-CC001", descricao: "[SANDBOX] Conta Itaú" } };
    case "incluir": return { cCodCCInt: (b as any)?.cCodCCInt || "SANDBOX-CC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Conta corrente incluída com sucesso" };
    case "alterar": return { cCodCCInt: (b as any)?.cCodCCInt || "SANDBOX-CC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Conta corrente alterada com sucesso" };
    case "excluir": return { cCodCCInt: "SANDBOX-CC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Conta corrente excluída com sucesso" };
    case "upsert": return { cCodCCInt: (b as any)?.cCodCCInt || "SANDBOX-CC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Upsert realizado com sucesso" };
    case "upsert-lote": return { lote: (b as any)?.lote || 1, cCodStatus: "0", cDesStatus: "[SANDBOX] 1 processado(s), 0 erro(s)" };
    default: return null;
  }
}

function mockLancamentosCc(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "": case "listar": return { nPagina: 1, nTotPaginas: 5, nRegistros: 20, nTotRegistros: 95, listaLancamentos: [{ nCodLanc: 12345, cCodIntLanc: "SANDBOX-LANC001", valor: 123.46, data: "21/03/2026" }] };
    case "consultar": return { lancamento: { nCodLanc: 12345, cCodIntLanc: "SANDBOX-LANC001", cabecalho: { nCodCC: 427619317, dDtLanc: "21/03/2026", nValorLanc: 123.46 }, detalhes: { cCodCateg: "1.01.02", cTipo: "DIN" } } };
    case "incluir": return { nCodLanc: null, cCodIntLanc: (b as any)?.cCodIntLanc || "SANDBOX-LANC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Lançamento incluído com sucesso" };
    case "alterar": return { cCodIntLanc: (b as any)?.cCodIntLanc || "SANDBOX-LANC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Lançamento alterado com sucesso" };
    case "excluir": return { cCodIntLanc: "SANDBOX-LANC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Lançamento excluído com sucesso" };
    case "upsert": return { cCodIntLanc: (b as any)?.cCodIntLanc || "SANDBOX-LANC001", cCodStatus: "0", cDesStatus: "[SANDBOX] Upsert realizado com sucesso" };
    case "upsert-lote": return { lote: (b as any)?.lote || 1, cCodStatus: "0", cDesStatus: "[SANDBOX] 1 processado(s), 0 erro(s)" };
    case "extrato": return { nCodCC: 427619317, cDescricao: "[SANDBOX] Conta Bradesco", nSaldoAnterior: 10000.00, nSaldoAtual: 15230.50, listaMovimentos: [{ data: "21/03/2026", descricao: "[SANDBOX] Pagamento", valor: -500, saldo: 14730.50 }] };
    default: return null;
  }
}

function mockBoletos(action: string): unknown {
  switch (action) {
    case "gerar": return { cLinkBoleto: "https://sandbox.example.com/boleto/SANDBOX-001", cCodStatus: "0", cDesStatus: "[SANDBOX] Boleto gerado com sucesso!" };
    case "obter": return { cLinkBoleto: "https://sandbox.example.com/boleto/SANDBOX-001", cCodStatus: "0", cDesStatus: "[SANDBOX] Boleto localizado com sucesso!" };
    case "cancelar": return { cCodStatus: "0", cDesStatus: "[SANDBOX] Boleto cancelado com sucesso!" };
    case "prorrogar": return { cLinkBoleto: "https://sandbox.example.com/boleto/SANDBOX-001", cCodStatus: "0", cDesStatus: "[SANDBOX] Boleto prorrogado com sucesso!" };
    case "listar": return { pagina: 1, total_de_paginas: 3, registros: 20, total_de_registros: 50, boletos: [{ id: "sandbox-bol-001", numero: "SANDBOX-001", valor: 1500, status: "gerado" }] };
    default: return null;
  }
}

function mockAnexos(action: string, body: unknown): unknown {
  switch (action) {
    case "incluir": return { cCodIntAnexo: (body as any)?.cCodIntAnexo || "SANDBOX-ANX-001", cCodStatus: "0", cDesStatus: "[SANDBOX] Anexo incluído com sucesso!" };
    case "consultar": return { cCodIntAnexo: "SANDBOX-ANX-001", cTabela: "contas_receber", cNomeArquivo: "comprovante.pdf", cTipoArquivo: "pdf" };
    case "obter": return { cLinkDownload: "https://sandbox.example.com/download/SANDBOX-ANX-001", dDtExpiracao: "21/03/2026", cCodStatus: "0" };
    case "listar": return { nPagina: 1, nTotPaginas: 1, nRegistros: 2, nTotRegistros: 2, listaAnexos: [{ cCodIntAnexo: "SANDBOX-ANX-001", cNomeArquivo: "comprovante.pdf" }] };
    case "excluir": return { cCodStatus: "0", cDesStatus: "[SANDBOX] Anexo excluído com sucesso!" };
    default: return null;
  }
}

function mockEmpresas(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "consultar": return { empresas_cadastro: { codigo_empresa: 8, codigo_empresa_integracao: "EMP001", razao_social: "[SANDBOX] BI Master Soluções Ltda", nome_fantasia: "BiMaster", cnpj: "12345678000199", regime_apuracao: "Competência", tipo_empresa: "Matriz", porte: "EPP", estado: "SP", cidade: "São Paulo", inativa: "N", inclusao_data: "15/01/2026", alteracao_data: "20/03/2026" } };
    case "listar": return { pagina: 1, total_de_paginas: 1, registros: 2, total_de_registros: 2, empresas_cadastro: [{ codigo_empresa: 8, codigo_empresa_integracao: "EMP001", razao_social: "[SANDBOX] BI Master Soluções Ltda", nome_fantasia: "BiMaster", cnpj: "12345678000199", regime_apuracao: "Competência", tipo_empresa: "Matriz", porte: "EPP" }] };
    case "incluir": return { codigo_empresa: 99, codigo_empresa_integracao: (b as any)?.codigo_empresa_integracao || "SANDBOX-EMP", codigo_status: "0", descricao_status: "[SANDBOX] Empresa incluída com sucesso!" };
    case "alterar": return { codigo_empresa: (b as any)?.codigo_empresa || 8, codigo_status: "0", descricao_status: "[SANDBOX] Empresa alterada com sucesso!" };
    default: return null;
  }
}

function mockDepartamentos(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "incluir": return { codigo: (b as any)?.codigo || "000000000723648", cCodStatus: "0", cDesStatus: "[SANDBOX] Departamento incluído com sucesso" };
    case "alterar": return { codigo: (b as any)?.codigo || "000000000723648", cCodStatus: "0", cDesStatus: "[SANDBOX] Departamento alterado com sucesso" };
    case "consultar": return { codigo: "000000000723648", descricao: "[SANDBOX] Marketing Digital", inativo: "N" };
    case "excluir": return { codigo: "000000000723648", cCodStatus: "0", cDesStatus: "[SANDBOX] Departamento excluído com sucesso" };
    case "listar": return { pagina: 1, total_de_paginas: 1, registros: 3, total_de_registros: 3, departamentos: [{ codigo: "000000000723648", descricao: "[SANDBOX] Marketing Digital" }] };
    default: return null;
  }
}

function mockCategorias(action: string, body: unknown): unknown {
  switch (action) {
    case "incluir": return { codigo: "SANDBOX-CAT-001", codigo_status: "0", descricao_status: "[SANDBOX] Categoria incluída com sucesso!" };
    case "incluir-grupo": return { codigo: "SANDBOX-GRP-001", codigo_status: "0", descricao_status: "[SANDBOX] Grupo de categoria incluído com sucesso!" };
    case "alterar": return { codigo: (body as any)?.codigo || "SANDBOX-CAT-001", codigo_status: "0", descricao_status: "[SANDBOX] Categoria alterada com sucesso!" };
    case "alterar-grupo": return { codigo: (body as any)?.codigo || "SANDBOX-GRP-001", codigo_status: "0", descricao_status: "[SANDBOX] Grupo alterado com sucesso!" };
    case "consultar": return { categoria_cadastro: { codigo: "SANDBOX-CAT-001", descricao: "[SANDBOX] Serviços Terceiros", tipo_categoria: "D" } };
    case "listar": return { pagina: 1, total_de_paginas: 3, registros: 50, total_de_registros: 125, categoria_cadastro: [{ codigo: "2.04.01", descricao: "[SANDBOX] Serviços Terceiros", tipo_categoria: "D" }] };
    default: return null;
  }
}

function mockClientes(action: string, body: unknown): unknown {
  switch (action) {
    case "listar": return { pagina: 1, total_de_paginas: 3, registros: 50, total_de_registros: 125, clientes_cadastro: [{ codigo_cliente_huggs: "sandbox-uuid", razao_social: "[SANDBOX] ABC Ltda", cnpj_cpf: "12.345.678/0001-90" }] };
    case "listar-resumido": return { pagina: 1, total_de_paginas: 3, registros: 50, total_de_registros: 125, clientes_cadastro_resumido: [{ codigo_cliente_huggs: "sandbox-uuid", razao_social: "[SANDBOX] ABC Ltda" }] };
    case "consultar": return { clientes_cadastro: { codigo_cliente_huggs: "sandbox-uuid", razao_social: "[SANDBOX] ABC Ltda" } };
    case "incluir": return { codigo_cliente_huggs: "sandbox-uuid", codigo_status: "0", descricao_status: "[SANDBOX] Cliente incluído com sucesso!" };
    case "alterar": return { codigo_status: "0", descricao_status: "[SANDBOX] Cliente alterado com sucesso!" };
    case "excluir": return { codigo_status: "0", descricao_status: "[SANDBOX] Cliente excluído com sucesso!" };
    case "upsert": case "upsert-cpfcnpj": return { codigo_cliente_huggs: "sandbox-uuid", codigo_status: "0", descricao_status: "[SANDBOX] Upsert realizado com sucesso!" };
    case "associar": return { codigo_status: "0", descricao_status: "[SANDBOX] Código de integração associado com sucesso!" };
    default: return null;
  }
}

function mockClientesCaract(action: string): unknown {
  if (action === "consultar") return { caracteristicas: [{ campo: "SEGMENTO", conteudo: "[SANDBOX] Varejo" }] };
  return { codigo_status: "0", descricao_status: "[SANDBOX] Operação realizada com sucesso!" };
}

function mockClientesTags(action: string): unknown {
  if (action === "listar") return { tagsLista: [{ tag: "[SANDBOX] Grupo A", nCodTag: 1 }] };
  return { cCodStatus: "0", cDesStatus: "[SANDBOX] Tags processadas com sucesso!" };
}

function mockProjetos(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "incluir": return { codigo: "sandbox-uuid", codInt: (b as any)?.codInt || "SANDBOX-PROJ-001", status: "0", descricao: "[SANDBOX] Projeto incluído com sucesso!" };
    case "alterar": return { status: "0", descricao: "[SANDBOX] Projeto alterado com sucesso!" };
    case "consultar": return { codigo: "sandbox-uuid", codInt: "SANDBOX-PROJ-001", nome: "[SANDBOX] Projeto Alpha", inativo: "N" };
    case "excluir": return { status: "0", descricao: "[SANDBOX] Projeto excluído com sucesso!" };
    case "listar": return { pagina: 1, total_de_paginas: 1, registros: 5, total_de_registros: 5, cadastro: [{ codInt: "SANDBOX-PROJ-001", nome: "[SANDBOX] Projeto Alpha" }] };
    case "upsert": return { status: "0", descricao: "[SANDBOX] Projeto incluído/alterado com sucesso!" };
    default: return null;
  }
}

function mockExportacao(action: string, body: unknown): unknown {
  switch (action) {
    case "pending": return { data: [{ id: "sandbox-uuid-001", export_type: "registration", fornecedor: { nome: "[SANDBOX] ABC Ltda" }, pagamento: { valor: 1500 } }], total: 1 };
    case "paid": return { data: [{ id: "sandbox-uuid-002", export_type: "payment", fornecedor: { nome: "[SANDBOX] XYZ Ltda" }, pagamento: { valor: 2300 } }], total: 1 };
    case "cancelled": return { data: [], total: 0 };
    case "confirm": return { confirmed: (body as any)?.ids?.length || 1, export_type: (body as any)?.export_type || "registration" };
    case "history": return { data: [{ id: "sandbox-exp-001", export_type: "registration", status: "exported", exported_at: "2026-03-15T10:00:00Z" }], total: 1 };
    case "export-batch": return { queued: (body as any)?.ids?.length || 1, skipped: 0, message: "[SANDBOX] 1 item(ns) enfileirado(s)" };
    case "retry-failed": return { requeued: 1, message: "[SANDBOX] 1 item(ns) reenfileirado(s)" };
    case "reconciliation": return { resumo: { total_titulos: 500, exportados: 480, com_erro: 5, taxa_sincronizacao: 96.0 } };
    case "export-summary": return { resumo: { por_empresa: [{ empresa_id: 8, total: 100, exportados: 95 }] } };
    default: return null;
  }
}

function mockParcelas(action: string): unknown {
  switch (action) {
    case "incluir": return { cCodStatus: "0", cDesStatus: "[SANDBOX] Parcela incluída com sucesso!", cCodParcela: "001", cDesParcela: "30/60/90" };
    case "listar": return { pagina: 1, total_de_paginas: 1, registros: 3, total_de_registros: 3, cadastros: [{ cCodParcela: "001", cDesParcela: "30/60/90" }] };
    default: return null;
  }
}

function mockBandeiras(action: string): unknown {
  if (action === "listar" || action === "") return { nPagina: 1, nTotPaginas: 1, nRegistros: 8, nTotRegistros: 8, listaBandeira: [{ cCodigo: "VISA", cDescricao: "Visa", cTipo: "credito" }] };
  return null;
}

function mockFornecedores(action: string, body: unknown): unknown {
  const b = body as Record<string, unknown> | null;
  switch (action) {
    case "": case "listar": return { fornecedores: [{ id: "sandbox-uuid", cnpj: "12345678000190", razao_social: "[SANDBOX] ABC Ltda", nome_fantasia: "ABC", erp_code: "4214850", status: "ativo", ativo: true, empresa_ids: [8] }], total: 1 };
    case "consultar": return { encontrado: true, fornecedor: { erp_code: "4214850", razao_social: "[SANDBOX] ABC Ltda", cnpj: "12345678000190" } };
    case "incluir": return { codigo_status: "0", descricao_status: "[SANDBOX] Fornecedor incluído com sucesso!", erp_code: "4214851" };
    case "alterar": return { codigo_status: "0", descricao_status: "[SANDBOX] Fornecedor alterado com sucesso!" };
    case "upsert": return { codigo_status: "0", descricao_status: "[SANDBOX] Fornecedor upsert realizado com sucesso!" };
    case "sync-bidirecional": return { sincronizados: 45, novos_no_erp: 3, novos_no_bimaster: 2, erros: 0 };
    case "cadastrar-todas": return { empresas_cadastradas: 3, erros: [] };
    default: return null;
  }
}

function mockPlanoContas(): unknown {
  return { plano_contas: [{ id: "sandbox-uuid", codigo: "2.04.01", nome: "[SANDBOX] Serviços Terceiros", erp_code: "ERP001", tipo: "D", ativo: true }], total: 25 };
}

function mockPortadores(action: string): unknown {
  switch (action) {
    case "": case "listar": return { data: [{ id: "sandbox-uuid", nome: "[SANDBOX] Banco Itaú", banco_codigo: "341", banco_nome: "Itaú Unibanco", agencia: "1234", conta: "56789-0", tipo: "corrente", codigo_erp: "PORT001" }, { id: "sandbox-uuid-2", nome: "[SANDBOX] Banco do Brasil", banco_codigo: "001", banco_nome: "Banco do Brasil S.A.", agencia: "5678", conta: "12345-6", tipo: "corrente", codigo_erp: "PORT002" }], total: 5 };
    case "consultar": return { id: "sandbox-uuid", nome: "[SANDBOX] Banco Itaú", banco_codigo: "341", banco_nome: "Itaú Unibanco", agencia: "1234", conta: "56789-0", tipo: "corrente" };
    case "sync": return { success: true, upserted: 5 };
    default: return null;
  }
}

function mockWebhooks(action: string, body: unknown): unknown {
  switch (action) {
    case "eventos": return { eventos: [{ evento: "conta_pagar.criado", descricao: "Novo título a pagar criado" }] };
    case "listar": return { subscriptions: [{ id: "sandbox-uuid", url: "https://sandbox.example.com/webhook", eventos: ["conta_pagar.criado"], ativo: true }], total: 1 };
    case "consultar": return { subscription: { id: "sandbox-uuid", url: "https://sandbox.example.com/webhook", eventos: ["conta_pagar.criado"], secret: "hmac-***", ativo: true } };
    case "incluir": return { id: "sandbox-uuid", message: "[SANDBOX] Assinatura criada com sucesso" };
    case "alterar": return { id: "sandbox-uuid", message: "[SANDBOX] Assinatura atualizada" };
    case "excluir": return { message: "[SANDBOX] Assinatura removida" };
    default: return null;
  }
}

function mockMisc(apiName: string, action: string): unknown {
  switch (apiName) {
    case "cnae": return { pagina: 1, total_de_paginas: 10, registros: 50, total_de_registros: 500, cadastros: [{ codigo: "47.11-3/02", descricao: "[SANDBOX] Comércio varejista" }] };
    case "cidades": return { pagina: 1, total_de_paginas: 112, registros: 50, total_de_registros: 5570, lista_cidades: [{ codigo: "3550308", cidade: "[SANDBOX] São Paulo", uf: "SP" }] };
    case "paises": return { lista_paises: [{ cCodigo: "1058", cDescricao: "BRASIL", cCodigoISO: "BR" }] };
    case "bancos": return action === "consultar" ? { codigo: "001", nome: "[SANDBOX] Banco do Brasil S.A." } : { pagina: 1, total_de_paginas: 1, registros: 50, total_de_registros: 50, fin_banco_cadastro: [{ codigo: "001", nome: "[SANDBOX] Banco do Brasil" }] };
    case "tipos-documento": return action === "consultar" ? { codigo: "NF", descricao: "[SANDBOX] Nota Fiscal" } : { tipo_documento_cadastro: [{ codigo: "NF", descricao: "[SANDBOX] Nota Fiscal" }] };
    case "dre-cadastro": return { totalRegistros: 25, dreLista: [{ codigoDRE: "4.1", descricaoDRE: "[SANDBOX] Receita Bruta" }] };
    case "finalidades-transf": return action === "consultar" ? { codigo: "01", descricao: "[SANDBOX] Crédito em Conta" } : { pagina: 1, total_de_paginas: 1, registros: 8, total_de_registros: 8, cadastros: [{ codigo: "01", descricao: "[SANDBOX] Crédito em Conta" }] };
    case "origens": return { pagina: 1, total_de_paginas: 1, registros: 6, total_de_registros: 6, origem: [{ codigo: "MANUAL", descricao: "[SANDBOX] Lançamento Manual" }] };
    case "tipos-atividade": return { lista_tipos_atividade: [{ cCodigo: "C", cDescricao: "[SANDBOX] Comércio" }] };
    case "tipos-anexo": return { listaTipoAnexo: [{ codigo: "NF", descricao: "[SANDBOX] Nota Fiscal" }] };
    case "tipos-entrega":
      if (action === "incluir") return { nCodEntrega: 1, cCodStatus: "0", cDesStatus: "[SANDBOX] Tipo de entrega incluído com sucesso" };
      if (action === "alterar") return { nCodEntrega: 1, cCodStatus: "0", cDesStatus: "[SANDBOX] Tipo de entrega alterado com sucesso" };
      if (action === "consultar") return { nCodTransp: 0, nCodEntrega: 1, cDescricao: "[SANDBOX] Entrega Normal", cInativo: "N" };
      if (action === "excluir") return { nCodEntrega: 1, cCodStatus: "0", cDesStatus: "[SANDBOX] Tipo de entrega excluído com sucesso" };
      if (action === "listar") return { nPagina: 1, nTotalPaginas: 1, nRegistros: 2, nTotalRegistros: 2, CadTiposEntrega: [{ nCodEntrega: 1, cDescricao: "[SANDBOX] Entrega Normal" }] };
      return null;
    case "orcamentos-caixa":
      if (action === "listar") return { nAno: 2026, nMes: 3, ListaOrcamentos: [{ cCodCateg: "2.04.01", nValorPrevisto: 5000.00, nValorRealizado: 3200.50 }] };
      if (action === "incluir") return { cCodStatus: "0", cDesStatus: "[SANDBOX] Orçamento cadastrado com sucesso" };
      if (action === "incluir-lote") return { cCodStatus: "0", nTotal: 2 };
      return null;
    case "pesquisar-lancamentos": return { nPagina: 1, nTotPaginas: 5, nRegistros: 20, nTotRegistros: 100, titulosEncontrados: [{ id: "sandbox-001", descricao: "[SANDBOX] Título exemplo", valor: 1500 }] };
    case "movimentos-financeiros": return { nPagina: 1, nTotPaginas: 5, nRegistros: 20, nTotRegistros: 100, movimentos: [{ id: "sandbox-001", descricao: "[SANDBOX] Pagamento", valor: 1500 }] };
    case "resumo-financeiro":
      if (action === "resumo") return { dDia: "21/03/2026", contaCorrente: { vTotal: 150000 }, contaPagar: { nTotal: 45, vTotal: 85000 }, contaReceber: { nTotal: 30, vTotal: 120000 } };
      if (action === "em-aberto") return { ListaEmEberto: [{ id: "sandbox-001", descricao: "[SANDBOX] Título", valor: 1500 }], nRegistros: 50, nTotPaginas: 3 };
      if (action === "lista-financas") return { listaDetalhesFinancas: [{ id: "sandbox-001", descricao: "[SANDBOX] Lançamento", valor: 1500 }] };
      if (action === "detalhes") return { cTipoLanc: "R", nIdTitulo: "sandbox-uuid", cNomeCliente: "[SANDBOX] ABC", vDoc: 1500 };
      return null;
    default: return null;
  }
}

// ═══════════════════════════════════════
// ROUTE RESOLVER
// ═══════════════════════════════════════

function parseRoute(path: string): { apiName: string; action: string } {
  const clean = path.replace(/^\/+/, "").replace(/\?.*$/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { apiName: "unknown", action: "" };
  return { apiName: parts[0], action: parts.slice(1).join("/") || "" };
}

function generateMockResponse(path: string, method: string, body: unknown): { status: number; data: unknown } {
  const { apiName, action } = parseRoute(path);

  if (action === "status") {
    return { status: 200, data: { status: "ok", function: apiName, sandbox: true, dry_run: true } };
  }

  let mockData: unknown = null;

  switch (apiName) {
    case "contas-pagar": mockData = mockContasPagar(action, body); break;
    case "contas-receber": mockData = mockContasReceber(action, body); break;
    case "contas-correntes": mockData = mockContasCorrentes(action, body); break;
    case "lancamentos-cc": mockData = mockLancamentosCc(action, body); break;
    case "boletos": mockData = mockBoletos(action); break;
    case "anexos": mockData = mockAnexos(action, body); break;
    case "empresas": mockData = mockEmpresas(action, body); break;
    case "departamentos": mockData = mockDepartamentos(action, body); break;
    case "categorias": mockData = mockCategorias(action, body); break;
    case "clientes":
      if (action.startsWith("caract/")) mockData = mockClientesCaract(action.replace("caract/", ""));
      else if (action.startsWith("tags/")) mockData = mockClientesTags(action.replace("tags/", ""));
      else mockData = mockClientes(action, body);
      break;
    case "projetos": mockData = mockProjetos(action, body); break;
    case "exportacao": case "erp-export-payment": mockData = mockExportacao(action, body); break;
    case "parcelas": mockData = mockParcelas(action); break;
    case "bandeiras": mockData = mockBandeiras(action); break;
    case "fornecedores-query": case "fornecedores-sync": mockData = mockFornecedores(action, body); break;
    case "plano-contas": mockData = mockPlanoContas(); break;
    case "portadores": mockData = mockPortadores(action); break;
    case "webhook-subscriptions": mockData = mockWebhooks(action, body); break;
    default: mockData = mockMisc(apiName, action); break;
  }

  if (mockData) {
    return { status: 200, data: { ...(mockData as Record<string, unknown>), sandbox: true, dry_run: true } };
  }

  return {
    status: 200,
    data: { sandbox: true, dry_run: true, message: `[SANDBOX] Mock não configurado para este endpoint. Resposta genérica.`, endpoint: path, method, apiName },
  };
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Apenas POST é permitido", req);
  }

  const startMs = Date.now();

  try {
    const auth = await validateJWT(req);
    const userId = auth.userId;

    const { path, method, body: reqBody } = await req.json();

    if (!path || !method) {
      return errorResponse(400, "VALIDATION_ERROR", "path e method são obrigatórios", req, startMs);
    }

    const mock = generateMockResponse(path, method, reqBody);
    const durationMs = Date.now() - startMs;

    // Log to sandbox_requests
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("sandbox_requests").insert({
      user_id: userId,
      endpoint: path,
      method: method.toUpperCase(),
      request_body: reqBody || null,
      response_body: mock.data,
      response_status: mock.status,
      duration_ms: durationMs,
    });

    return jsonResponse(
      { ...mock.data as Record<string, unknown>, environment: "sandbox" },
      mock.status,
      req,
      { startMs }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, "UNAUTHORIZED", err.message, req, startMs);
    }
    console.error("❌ api-sandbox error:", err);
    return errorResponse(500, "SANDBOX_ERROR", err instanceof Error ? err.message : "Erro interno do sandbox", req, startMs);
  }
});

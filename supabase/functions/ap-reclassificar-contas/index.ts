import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";
import { callAIGateway } from "../_shared/ai-gateway-call.ts";

const BodySchema = z.object({
  action: z.enum(["start", "latest", "status", "process", "cancel"]),
  jobId: z.string().uuid().optional(),
  batchSize: z.number().int().min(1).max(20).optional(),
}).strict();

type Client = ReturnType<typeof createClient>;

interface Department {
  id: string;
  nome: string;
  descricao?: string | null;
}

interface AccountPlan {
  id: string;
  code: string;
  name: string;
  account_type?: string | null;
}

interface GroupRow {
  id: string;
  job_id: string;
  categoria_nome: string;
  fornecedor_nome: string | null;
  tipo_documento: string | null;
  centro_custo_id: string | null;
  centro_custo_codigo: string | null;
  centro_custo_nome: string | null;
  account_count: number;
}

interface Classification {
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confidence: number;
  justification: string;
  source: "regra_aprendida" | "centro_custo" | "dicionario" | "ia" | "fallback";
}

const norm = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const includesAny = (source: string, terms: string[]) => terms.some((term) => source.includes(norm(term)));

const ACCOUNT_RULES: Array<{ terms: string[]; code: string; reason: string }> = [
  { terms: ["COMPRA DE MERCADORIA", "PRODUTOS", "FORNECEDORES DE PRODUTOS"], code: "2.1.1.1", reason: "Compra de mercadorias para revenda" },
  { terms: ["RUBY ROSE", "MARCA - RUBY"], code: "2.1.1.3", reason: "Compra vinculada à marca Ruby Rose" },
  { terms: ["IMPORTACAO", "CHINA"], code: "2.1.1.2", reason: "Importação de mercadorias" },
  { terms: ["DEVOLUCAO", "PAGAMENTOS DE DEVOLUCAO"], code: "2.1.2", reason: "Devoluções de clientes" },
  { terms: ["EMBALAGEM", "CAIXAS", "ETIQUETAS"], code: "2.2.1", reason: "Embalagens e materiais de postagem" },
  { terms: ["TRANSPORTADORA", "FRETE", "LOGISTICA", "ARMAZENAGEM"], code: "2.4.1", reason: "Fretes e transportadoras" },
  { terms: ["AGREGADOS", "CARGA E DESCARGA"], code: "2.4.2", reason: "Serviços agregados de transporte" },
  { terms: ["CORREIOS"], code: "2.4.3", reason: "Correios e postagem" },
  { terms: ["ESCOLTA"], code: "2.4.4", reason: "Escolta de carga" },
  { terms: ["SEGURO DE TRANSPORTE"], code: "2.4.5", reason: "Seguro da mercadoria em transporte" },
  { terms: ["SIMPLES", "TRIBUTOS FEDERAIS", "IMPOSTO FEDERAL"], code: "2.5.1", reason: "Tributos federais sobre operação" },
  { terms: ["ICMS", "GNRE", "TRIBUTOS ESTADUAIS", "IMPOSTO ESTADUAL"], code: "2.5.2", reason: "Tributos estaduais" },
  { terms: ["PIS"], code: "2.5.3", reason: "PIS" },
  { terms: ["COFINS"], code: "2.5.4", reason: "COFINS" },
  { terms: ["COMISSAO", "REPRESENTANTE", "GERENTE", "SUPERVISOR", "COORDENADOR"], code: "2.6.1", reason: "Comissões de vendas" },
  { terms: ["PROMOTOR", "TABLOID", "NEGOCIACOES", "SAO PAULO", "SUL:", "SUDESTE", "CENTROESTE"], code: "2.6.2", reason: "Despesas de trade comercial" },
  { terms: ["TARIFAS BANCARIAS", "TAXAS ADMINISTRATIVAS", "ENCARGOS FINANCEIROS", "JUROS/MULTAS"], code: "3.4.1", reason: "Despesas bancárias e encargos" },
  { terms: ["SALARIOS", "HORAS EXTRAS", "ADIANTAMENTO", "AJUDA DE CUSTO"], code: "3.2.1.1", reason: "Folha salarial e verbas recorrentes" },
  { terms: ["TERCEIRIZ", "MAO DE OBRA"], code: "3.2.2.1", reason: "Mão de obra terceirizada" },
  { terms: ["VALE TRANSPORTE", "TRANSPORTE DOS COLABORADORES"], code: "3.2.3.1", reason: "Transporte de colaboradores" },
  { terms: ["MEDICINA", "SEGURANCA OCUPACIONAL"], code: "3.2.5", reason: "Medicina e segurança do trabalho" },
  { terms: ["PONTO"], code: "3.2.6", reason: "Sistema de ponto" },
  { terms: ["13", "DECIMO"], code: "3.2.7", reason: "13º salário" },
  { terms: ["FERIAS"], code: "3.2.8", reason: "Férias" },
  { terms: ["RESCISAO", "DEMIS"], code: "3.2.9", reason: "Rescisões e encargos" },
  { terms: ["RECRUTAMENTO", "TREINAMENTO", "PALESTRA"], code: "3.2.11", reason: "Treinamento e recrutamento" },
  { terms: ["CESTA"], code: "3.2.12.1", reason: "Cestas básicas" },
  { terms: ["PLANO DE SAUDE", "SEGURO DE PESSOAL"], code: "3.2.12.2", reason: "Plano de saúde" },
  { terms: ["VALE REFEICAO", "VALE ALIMENTACAO"], code: "3.2.12.3", reason: "Vale alimentação/refeição" },
  { terms: ["PREMI", "BONIFIC", "GUELTA"], code: "3.2.13.2", reason: "Premiações e bônus" },
  { terms: ["UNIFORME", "SINDICATO", "PENSAO"], code: "3.2.14", reason: "Outras despesas com pessoal" },
  { terms: ["ALUGUEL DE DEPOSITO"], code: "3.1.1.1", reason: "Aluguel de depósito" },
  { terms: ["ALUGUEL DE ESCRITORIO"], code: "3.1.1.2", reason: "Aluguel de escritório" },
  { terms: ["ALUGUEL", "LOCACAO", "EMPILHADEIRA"], code: "3.1.19", reason: "Locações" },
  { terms: ["ELETRICIDADE", "LUZ"], code: "3.1.2", reason: "Conta de luz" },
  { terms: ["AGUA"], code: "3.1.3", reason: "Conta de água" },
  { terms: ["INTERNET", "PROVEDOR"], code: "3.1.4", reason: "Internet" },
  { terms: ["TELEFONIA FIXA", "PABX"], code: "3.1.5.1", reason: "Telefonia fixa" },
  { terms: ["TELEFONIA MOVEL"], code: "3.1.5.2", reason: "Telefonia móvel" },
  { terms: ["IPTU"], code: "3.1.6.1", reason: "IPTU" },
  { terms: ["IMPOSTOS/TAXAS", "TRIBUTOS MUNICIPAIS", "TAXAS EM GERAL", "MULTAS"], code: "3.1.6.2", reason: "Outros impostos e taxas" },
  { terms: ["MATERIAIS DE ESCRITORIO", "MATERIAIS / FERRAMENTAS", "FERRAMENTAS"], code: "3.1.7", reason: "Materiais de escritório e informática" },
  { terms: ["SEGURANCA", "MONITORAMENTO", "CAMERAS", "ALARME"], code: "3.1.8.1", reason: "Segurança e monitoramento" },
  { terms: ["CONTABILIDADE"], code: "3.1.8.3", reason: "Contabilidade terceirizada" },
  { terms: ["FREELANCER", "FREELANCE"], code: "3.1.8.4", reason: "Freelancers" },
  { terms: ["DEDETIZACAO"], code: "3.1.8.5", reason: "Dedetização" },
  { terms: ["IMPRESSORAS - MANUTENCAO"], code: "3.1.8.6", reason: "Manutenção de impressoras" },
  { terms: ["SERASA", "CONSULTA DE CREDITO"], code: "3.1.8.7", reason: "Consulta de crédito" },
  { terms: ["LEGAL", "ADVOG", "PROCESSO TRABALHISTA"], code: "3.1.8.8", reason: "Custos jurídicos" },
  { terms: ["SERVICOS DE TERCEIROS", "PRESTACAO DE SERVICOS", "CONSULTORIA"], code: "3.1.8.9", reason: "Outros serviços" },
  { terms: ["MANUTENCAO", "REFORMA", "REDE ELETRICA"], code: "3.1.9.1", reason: "Manutenção predial" },
  { terms: ["COMBUSTIVEL"], code: "3.1.10.3", reason: "Combustível" },
  { terms: ["SEGURO DEPOSITO"], code: "3.1.11.1", reason: "Seguro de galpão/depósito" },
  { terms: ["SEGUROESCRITORIO"], code: "3.1.11.2", reason: "Seguro de escritório" },
  { terms: ["SEGURO BENS", "SEGUROS BENS"], code: "3.1.11.3", reason: "Seguro de bens" },
  { terms: ["CARTORIO"], code: "3.1.12", reason: "Cartório" },
  { terms: ["MATERIAL DE COPA", "GARRAFAS DE AGUA", "LIMPEZA"], code: "3.1.14", reason: "Material de copa, limpeza e higiene" },
  { terms: ["PASSAGENS", "TAXI", "UBER", "ESTACIONAMENTO"], code: "3.1.15", reason: "Transporte urbano" },
  { terms: ["LANCHES", "REFEICOES", "ALIMENTACAO"], code: "3.1.16", reason: "Refeições" },
  { terms: ["REEMBOLSO", "COFRE"], code: "3.1.17", reason: "Reembolso de despesas" },
  { terms: ["VIAGEM", "HOTEL", "HOSPEDAGEM"], code: "3.1.18", reason: "Despesas de viagem" },
  { terms: ["CARTAO DE CREDITO"], code: "3.1.20", reason: "Cartão de crédito" },
  { terms: ["HARDWARE", "COMPUTADORES", "EQUIPAMENTO"], code: "3.1.21", reason: "Hardware e acessórios" },
  { terms: ["SOFTWARE", "SISTEMA", "SITES", "DOMINIO"], code: "3.1.22", reason: "Softwares" },
  { terms: ["DIVERSOS", "OUTROS", "FARMACIA", "ANUIDADE"], code: "3.1.23", reason: "Outras despesas administrativas" },
  { terms: ["AGENCIAS", "PUBLICIDADE", "VEICULACAO", "FOTOS", "LAY-OUT", "PRODUTORA AUDIOVISUAL"], code: "3.3.1", reason: "Publicidade e propaganda" },
  { terms: ["EVENTO", "BUFFE", "CENOGRAFIA", "CONVITES"], code: "3.3.2", reason: "Eventos" },
  { terms: ["BRINDES", "PRODUTOS/BRINDES"], code: "3.3.3", reason: "Prêmios e brindes" },
  { terms: ["DISPLAY", "VITRINE", "MATERIAIS GRAFICOS", "PALETEIRA"], code: "3.3.5", reason: "Expositores e materiais gráficos" },
  { terms: ["CONSULTORIA MARKETING"], code: "3.3.6", reason: "Consultoria de marketing" },
  { terms: ["STAND"], code: "3.3.7", reason: "Stand" },
  { terms: ["ROYALTIES", "DIREITOS AUTORAIS"], code: "3.3.8", reason: "Royalties" },
  { terms: ["MODELOS", "MANEQUINS"], code: "3.3.9", reason: "Modelos" },
  { terms: ["INFLUENCER"], code: "3.3.10", reason: "Influencers" },
  { terms: ["MIDIA SOCIAL"], code: "3.3.11", reason: "Mídia social" },
  { terms: ["COMUNICACAO VISUAL"], code: "3.3.12", reason: "Comunicação visual" },
  { terms: ["PRO LABORE"], code: "3.5.1", reason: "Pró-labore" },
  { terms: ["ESTORNO"], code: "4.1.1", reason: "Receita não operacional" },
  { terms: ["MOVEIS", "PALETES", "PORTA PALETES", "IMOBILIZADO"], code: "4.2.3", reason: "Equipamentos, utensílios e veículos" },
  { terms: ["EMPRESTIMOS"], code: "4.3.1", reason: "Empréstimos bancários" },
  { terms: ["RECEITAS FINANCEIRAS", "REND APLIC", "TRANSFERENCIA"], code: "4.3.5", reason: "Receitas financeiras" },
  { terms: ["DIVIDENDOS", "DISTRIBUICAO DE LUCRO"], code: "4.4.2", reason: "Distribuição de lucros" },
];

const COST_CENTER_DEPT_RULES: Array<{ terms: string[]; deptTerms: string[]; confidence: number }> = [
  { terms: ["CMV", "COMPRAS PARA REVENDA", "CUSTO DE VENDAS", "MARCA"], deptTerms: ["Compras", "Faturamento"], confidence: 0.96 },
  { terms: ["SALARIO", "BENEF", "FUNCION", "PREMIACAO FUNCIONARIOS", "EVENTOS INTERNOS"], deptTerms: ["Recursos Humanos"], confidence: 0.98 },
  { terms: ["TRIBUT", "IMPOST", "FINANCEIR", "CREDITO", "SALDO BANCARIO"], deptTerms: ["Financeiro"], confidence: 0.96 },
  { terms: ["COMISSOES", "INCENTIVOS DE VENDAS", "DISPLAY CLIENTES"], deptTerms: ["Comercial", "Trade"], confidence: 0.94 },
  { terms: ["TRANSPORTE", "LOGISTICA", "WAREHOUSE", "ESCOLTA"], deptTerms: ["Logística"], confidence: 0.98 },
  { terms: ["TECNOLOGIA", "INFORMACAO", "FERRAMENTA FISCAL"], deptTerms: ["TI"], confidence: 0.96 },
  { terms: ["MARKETING", "MKT", "FEIRAS", "EVENTOS", "DIVULGACAO", "COMUNICACAO", "AUDIOVISUAL", "IMPRENSA"], deptTerms: ["Marketing"], confidence: 0.95 },
  { terms: ["EMBALAGENS", "MANUTENCAO", "REFORMA", "SEGURANCA", "UTILIDADES"], deptTerms: ["Operações"], confidence: 0.88 },
  { terms: ["ALUGUEIS", "EVENTUAIS", "CAIXA INTERNO", "SERVICOS DE TERCEIROS", "CONSULTORES", "PRO LABORE", "DIVIDENDOS"], deptTerms: ["Administrativo"], confidence: 0.86 },
];

function findDepartmentByTerms(departamentos: Department[], terms: string[]): Department | null {
  for (const term of terms) {
    const hit = departamentos.find((d) => norm(d.nome).includes(norm(term)));
    if (hit) return hit;
  }
  return null;
}

function inferDepartment(group: GroupRow, departamentos: Department[]): { dept: Department | null; confidence: number; reason: string } {
  const text = norm(`${group.centro_custo_nome || ""} ${group.categoria_nome || ""} ${group.fornecedor_nome || ""}`);
  for (const rule of COST_CENTER_DEPT_RULES) {
    if (includesAny(text, rule.terms)) {
      const dept = findDepartmentByTerms(departamentos, rule.deptTerms);
      if (dept) {
        return {
          dept,
          confidence: rule.confidence,
          reason: `Departamento definido pelo Centro de Custo "${group.centro_custo_nome || "não informado"}"`,
        };
      }
    }
  }
  const fallback = findDepartmentByTerms(departamentos, ["Administrativo"]);
  return {
    dept: fallback,
    confidence: group.centro_custo_id ? 0.72 : 0.58,
    reason: group.centro_custo_id
      ? `Centro de Custo sem regra específica; aplicada classificação administrativa conservadora`
      : `Sem Centro de Custo informado; aplicada classificação administrativa conservadora`,
  };
}

function findAccountByCode(planos: AccountPlan[], code: string): AccountPlan | null {
  return planos.find((p) => p.code === code) || null;
}

function inferAccount(group: GroupRow, planos: AccountPlan[]): { account: AccountPlan | null; confidence: number; reason: string } {
  const text = norm(`${group.categoria_nome} ${group.fornecedor_nome || ""} ${group.centro_custo_nome || ""}`);
  for (const rule of ACCOUNT_RULES) {
    if (includesAny(text, rule.terms)) {
      const account = findAccountByCode(planos, rule.code);
      if (account) return { account, confidence: 0.94, reason: rule.reason };
    }
  }
  const cc = norm(group.centro_custo_nome);
  const ccFallbacks: Array<{ terms: string[]; code: string; reason: string }> = [
    { terms: ["CMV", "COMPRAS"], code: "2.1.1.1", reason: "Fallback por Centro de Custo de compras/CMV" },
    { terms: ["TRANSPORTE", "LOGISTICA"], code: "2.4.1", reason: "Fallback por Centro de Custo logístico" },
    { terms: ["SALARIO", "BENEF"], code: "3.2.1.1", reason: "Fallback por Centro de Custo de pessoal" },
    { terms: ["TRIBUT"], code: "2.5.1", reason: "Fallback por Centro de Custo tributário" },
    { terms: ["FINANCEIR"], code: "3.4.1", reason: "Fallback por Centro de Custo financeiro" },
    { terms: ["TECNOLOGIA"], code: "3.1.22", reason: "Fallback por Centro de Custo de tecnologia" },
    { terms: ["MARKETING", "MKT", "EVENTOS"], code: "3.3.13", reason: "Fallback por Centro de Custo de marketing" },
  ];
  for (const rule of ccFallbacks) {
    if (includesAny(cc, rule.terms)) {
      const account = findAccountByCode(planos, rule.code);
      if (account) return { account, confidence: 0.78, reason: rule.reason };
    }
  }
  return {
    account: findAccountByCode(planos, "3.1.23"),
    confidence: 0.55,
    reason: "Sem regra contábil específica; classificado como outras despesas administrativas para cobertura técnica",
  };
}

async function classifyWithAI(group: GroupRow, departamentos: Department[], planos: AccountPlan[]): Promise<Classification | null> {
  const planoText = planos.map((p) => `${p.code} - ${p.name}`).join("\n");
  const deptText = departamentos.map((d) => d.nome).join("\n");

  const result = await callAIGateway({
    model: "google/gemini-3-flash-preview",
    timeoutMs: 45_000,
    messages: [
      {
        role: "system",
        content: `Você é um contador brasileiro especializado em classificação de despesas. Use o Centro de Custo como âncora principal para Departamento. Use somente departamentos e contas listadas. Não invente códigos.`,
      },
      {
        role: "user",
        content: `Classifique a conta:\nCategoria: ${group.categoria_nome}\nFornecedor: ${group.fornecedor_nome || "N/A"}\nTipo: ${group.tipo_documento || "N/A"}\nCentro de Custo: ${group.centro_custo_nome || "N/A"}\n\nDepartamentos:\n${deptText}\n\nPlano de Contas:\n${planoText}`,
      },
    ],
    tools: [{
      type: "function",
      function: {
        name: "classificar",
        description: "Classifica uma despesa em departamento e plano de contas",
        parameters: {
          type: "object",
          properties: {
            departamento_nome: { type: "string" },
            plano_contas_codigo: { type: "string" },
            confianca: { type: "number" },
            justificativa: { type: "string" },
          },
          required: ["departamento_nome", "plano_contas_codigo", "confianca", "justificativa"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "classificar" } },
  });

  if (result.kind !== "ok") return null;
  const argsRaw = result.data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsRaw) return null;
  const args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
  const dept = departamentos.find((d) => norm(d.nome) === norm(args.departamento_nome));
  const account = planos.find((p) => p.code === args.plano_contas_codigo);
  if (!dept || !account) return null;

  return {
    departamento_id: dept.id,
    departamento_nome: dept.nome,
    plano_contas_id: account.id,
    plano_contas_codigo: account.code,
    plano_contas_nome: account.name,
    confidence: Math.max(0.3, Math.min(Number(args.confianca) || 0.7, 0.98)),
    justification: `IA com Centro de Custo como âncora: ${args.justificativa || "classificação gerada"}`,
    source: "ia",
  };
}

async function classifyGroup(group: GroupRow, supabase: Client, departamentos: Department[], planos: AccountPlan[]): Promise<Classification> {
  const ruleQuery = supabase
    .from("account_classification_rules")
    .select("departamento_id, plano_contas_id, confidence_score")
    .eq("categoria_nome", group.categoria_nome)
    .filter("fornecedor_nome", group.fornecedor_nome === null ? "is" : "eq", group.fornecedor_nome === null ? null : group.fornecedor_nome)
    .filter("tipo_documento", group.tipo_documento === null ? "is" : "eq", group.tipo_documento === null ? null : group.tipo_documento)
    .filter("centro_custo_id", group.centro_custo_id === null ? "is" : "eq", group.centro_custo_id === null ? null : group.centro_custo_id)
    .maybeSingle();

  const { data: existingRule } = await ruleQuery;
  if (existingRule?.departamento_id && existingRule?.plano_contas_id) {
    const dept = departamentos.find((d) => d.id === existingRule.departamento_id);
    const account = planos.find((p) => p.id === existingRule.plano_contas_id);
    if (dept && account) {
      return {
        departamento_id: dept.id,
        departamento_nome: dept.nome,
        plano_contas_id: account.id,
        plano_contas_codigo: account.code,
        plano_contas_nome: account.name,
        confidence: Number(existingRule.confidence_score) || 0.95,
        justification: `Regra aprendida aplicada para categoria/fornecedor/tipo/centro de custo`,
        source: "regra_aprendida",
      };
    }
  }

  const deptResult = inferDepartment(group, departamentos);
  const accountResult = inferAccount(group, planos);
  if (deptResult.dept && accountResult.account) {
    return {
      departamento_id: deptResult.dept.id,
      departamento_nome: deptResult.dept.nome,
      plano_contas_id: accountResult.account.id,
      plano_contas_codigo: accountResult.account.code,
      plano_contas_nome: accountResult.account.name,
      confidence: Math.min(deptResult.confidence, accountResult.confidence),
      justification: `${deptResult.reason}. Plano: ${accountResult.reason}.`,
      source: accountResult.confidence >= 0.9 ? "dicionario" : "centro_custo",
    };
  }

  const ai = await classifyWithAI(group, departamentos, planos).catch((e) => {
    logger.warn("Falha no fallback IA", e);
    return null;
  });
  if (ai) return ai;

  return {
    departamento_id: deptResult.dept?.id || null,
    departamento_nome: deptResult.dept?.nome || null,
    plano_contas_id: accountResult.account?.id || null,
    plano_contas_codigo: accountResult.account?.code || null,
    plano_contas_nome: accountResult.account?.name || null,
    confidence: Math.min(deptResult.confidence, accountResult.confidence, 0.62),
    justification: `${deptResult.reason}. ${accountResult.reason}. Revisar por baixa confiança.`,
    source: "fallback",
  };
}

async function getJob(supabase: Client, jobId: string) {
  const { data, error } = await supabase
    .from("ap_reclassification_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getRecentGroups(supabase: Client, jobId: string) {
  const { data } = await supabase
    .from("ap_reclassification_job_groups")
    .select("categoria_nome, fornecedor_nome, centro_custo_nome, account_count, status, departamento_nome, plano_contas_codigo, plano_contas_nome, confidence_score, justification, error_message, processed_at")
    .eq("job_id", jobId)
    .in("status", ["completed", "failed"])
    .order("processed_at", { ascending: false, nullsFirst: false })
    .limit(12);
  return data || [];
}

Deno.serve(secureHandler({ auth: "jwt", rateLimit: 120, rateLimitPrefix: "ap-reclassificar-contas" }, async (req, ctx) => {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Backend não configurado");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const userId = ctx.userId;
    if (!userId) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Ação restrita a administradores" }), { status: 403, headers });
    }

    const { action, jobId, batchSize = 8 } = parsed.data;

    if (action === "latest") {
      const { data: latest, error } = await supabase
        .from("ap_reclassification_jobs")
        .select("*")
        .eq("created_by", userId)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ job: latest, recent: latest?.id ? await getRecentGroups(supabase, latest.id) : [] }), { headers });
    }

    if (action === "start") {
      const { data: job, error } = await supabase
        .from("ap_reclassification_jobs")
        .insert({ created_by: userId, status: "pending", include_manual: true, use_cost_center_anchor: true })
        .select("*")
        .single();
      if (error) throw error;

      const { data: prepared, error: prepError } = await supabase.rpc("ap_prepare_reclassification_job", { p_job_id: job.id });
      if (prepError) throw prepError;
      const refreshed = await getJob(supabase, job.id);

      return new Response(JSON.stringify({ job: refreshed || job, prepared }), { headers });
    }

    if (!jobId) return new Response(JSON.stringify({ error: "jobId obrigatório" }), { status: 400, headers });

    const job = await getJob(supabase, jobId);
    if (!job || job.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), { status: 404, headers });
    }

    if (action === "cancel") {
      const { data, error } = await supabase
        .from("ap_reclassification_jobs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .select("*")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ job: data, recent: await getRecentGroups(supabase, jobId) }), { headers });
    }

    if (action === "status") {
      const { data: progress } = await supabase.rpc("ap_refresh_reclassification_job_progress", { p_job_id: jobId });
      return new Response(JSON.stringify({ job: await getJob(supabase, jobId), progress, recent: await getRecentGroups(supabase, jobId) }), { headers });
    }

    if (action === "process") {
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        return new Response(JSON.stringify({ job, recent: await getRecentGroups(supabase, jobId), processedNow: 0 }), { headers });
      }

      await supabase.from("ap_reclassification_jobs").update({ status: "running", started_at: job.started_at || new Date().toISOString() }).eq("id", jobId);

      const [{ data: grupos, error: claimError }, { data: departamentos, error: deptError }, { data: planos, error: planError }] = await Promise.all([
        supabase.rpc("ap_claim_reclassification_groups", { p_job_id: jobId, p_limit: batchSize }),
        supabase.from("departamentos").select("id, nome, descricao").eq("ativo", true).order("nome"),
        supabase.from("trade_chart_of_accounts").select("id, code, name, account_type").eq("is_active", true).eq("permite_lancamento", true).order("code"),
      ]);

      if (claimError) throw claimError;
      if (deptError) throw deptError;
      if (planError) throw planError;

      let processedNow = 0;
      for (const group of ((grupos || []) as GroupRow[])) {
        try {
          await supabase.from("ap_reclassification_jobs").update({ current_group: `${group.categoria_nome} · ${group.centro_custo_nome || "sem centro de custo"}` }).eq("id", jobId);
          const classification = await classifyGroup(group, supabase, (departamentos || []) as Department[], (planos || []) as AccountPlan[]);

          if (!classification.departamento_id || !classification.plano_contas_id) {
            throw new Error("Classificação incompleta: departamento ou plano de contas não encontrado");
          }

          const finalJustification = `[${classification.source}] ${classification.justification}`;
          const { data: affected, error: applyError } = await supabase.rpc("ap_apply_reclassification_group", {
            p_job_group_id: group.id,
            p_user_id: userId,
            p_departamento_id: classification.departamento_id,
            p_departamento_nome: classification.departamento_nome,
            p_plano_contas_id: classification.plano_contas_id,
            p_plano_contas_codigo: classification.plano_contas_codigo,
            p_plano_contas_nome: classification.plano_contas_nome,
            p_confidence: classification.confidence,
            p_justification: finalJustification,
          });
          if (applyError) throw applyError;

          await supabase.from("ap_reclassification_job_groups").update({
            status: "completed",
            departamento_id: classification.departamento_id,
            departamento_nome: classification.departamento_nome,
            plano_contas_id: classification.plano_contas_id,
            plano_contas_codigo: classification.plano_contas_codigo,
            plano_contas_nome: classification.plano_contas_nome,
            confidence_score: classification.confidence,
            justification: `${finalJustification}. Contas atualizadas: ${affected || 0}.`,
            error_message: null,
            processed_at: new Date().toISOString(),
          }).eq("id", group.id);

          await supabase.from("account_classification_rules").upsert({
            categoria_nome: group.categoria_nome,
            fornecedor_nome: group.fornecedor_nome,
            tipo_documento: group.tipo_documento,
            centro_custo_id: group.centro_custo_id,
            departamento_id: classification.departamento_id,
            plano_contas_id: classification.plano_contas_id,
            confidence_score: classification.confidence,
            times_used: group.account_count,
            last_used_at: new Date().toISOString(),
            created_by: userId,
          }, { onConflict: "categoria_nome,fornecedor_nome,tipo_documento,centro_custo_id" });

          processedNow++;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          logger.error("Erro ao processar grupo AP", message);
          await supabase.from("ap_reclassification_job_groups").update({
            status: "failed",
            error_message: message,
            processed_at: new Date().toISOString(),
          }).eq("id", group.id);
          processedNow++;
        }
      }

      const { data: progress, error: refreshError } = await supabase.rpc("ap_refresh_reclassification_job_progress", { p_job_id: jobId });
      if (refreshError) throw refreshError;

      return new Response(JSON.stringify({ job: await getJob(supabase, jobId), progress, recent: await getRecentGroups(supabase, jobId), processedNow }), { headers });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers });
  } catch (error) {
    logger.error("ap-reclassificar-contas erro", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), { status: 500, headers });
  }
}));
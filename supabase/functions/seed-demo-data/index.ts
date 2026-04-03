import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the calling user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Usuário não autenticado");

    const userId = user.id;
    const now = new Date().toISOString();

    // ─── 1. Create Demo Project ───
    const { data: projeto, error: projErr } = await supabase.from("projetos").insert({
      nome: "Linha Hidratante Verão 2026",
      descricao: "Projeto demonstrativo com dados fictícios para simular o ciclo de vida completo de desenvolvimento de produto — da ideia ao lançamento.",
      cor: "#0891b2",
      icone: "🧴",
      criador_id: userId,
      status: "ativo",
      visibilidade: "equipe",
      tipo: "produto",
      marca: "Banana Beauty",
      categoria_linha: "Cuidados Corporais",
    }).select("id").single();
    if (projErr) throw projErr;
    const projetoId = projeto.id;

    // Add user as project member
    await supabase.from("projeto_membros").insert({
      projeto_id: projetoId,
      user_id: userId,
      papel: "gerente",
    });

    // ─── 2. Create Sections (12 stages) ───
    const secoes = [
      { nome: "1. Ideia / Briefing", ordem: 0 },
      { nome: "2. Projeto / Planejamento", ordem: 1 },
      { nome: "3. Pré-Cadastro", ordem: 2 },
      { nome: "4. Desenvolvimento (China)", ordem: 3 },
      { nome: "5. Composição / INCI", ordem: 4 },
      { nome: "6. Amostras / Testes", ordem: 5 },
      { nome: "7. Embalagem", ordem: 6 },
      { nome: "8. Regulatório", ordem: 7 },
      { nome: "9. Etiqueta / Bula", ordem: 8 },
      { nome: "10. Artes Finais", ordem: 9 },
      { nome: "11. Aprovação Final", ordem: 10 },
      { nome: "12. Produção / Lançamento", ordem: 11 },
    ];

    const { data: secoesData, error: secErr } = await supabase
      .from("projeto_secoes")
      .insert(secoes.map(s => ({ ...s, projeto_id: projetoId })))
      .select("id, nome, ordem");
    if (secErr) throw secErr;

    const secaoMap: Record<number, string> = {};
    for (const s of secoesData) secaoMap[s.ordem] = s.id;

    // ─── 3. Create Tasks per Section ───
    const tarefas = [
      // Stage 1: Ideia
      { secao_ordem: 0, titulo: "Definir briefing de linha hidratante", status: "concluida", prioridade: "alta", descricao: "Pesquisar tendências de mercado e definir proposta do produto." },
      { secao_ordem: 0, titulo: "Análise de concorrência e benchmark", status: "concluida", prioridade: "media", descricao: "Levantar produtos similares no mercado nacional." },
      // Stage 2: Projeto
      { secao_ordem: 1, titulo: "Montar equipe multidisciplinar", status: "concluida", prioridade: "alta", descricao: "Alocar membros de P&D, Marketing, Regulatório e Supply Chain." },
      { secao_ordem: 1, titulo: "Definir cronograma macro", status: "concluida", prioridade: "alta", descricao: "Estabelecer milestones e datas-limite." },
      // Stage 3: Pré-Cadastro
      { secao_ordem: 2, titulo: "Cadastrar SKUs preliminares", status: "concluida", prioridade: "media", descricao: "Criar códigos internos para 3 produtos da linha." },
      // Stage 4: Desenvolvimento China
      { secao_ordem: 3, titulo: "Enviar briefing para fábrica China", status: "concluida", prioridade: "alta", descricao: "Incluir especificações de fórmula e embalagem." },
      { secao_ordem: 3, titulo: "Receber cotação e negociar MOQ", status: "concluida", prioridade: "alta", descricao: "Negociação de preço unitário e quantidade mínima." },
      { secao_ordem: 3, titulo: "Aprovar PI (Proforma Invoice)", status: "em_andamento", prioridade: "alta", descricao: "Verificar preços, quantidades e condições comerciais." },
      // Stage 5: Composição
      { secao_ordem: 4, titulo: "Revisar INCI List v1", status: "em_andamento", prioridade: "critica", descricao: "Verificar conformidade ANVISA de todos os ingredientes." },
      { secao_ordem: 4, titulo: "Validar percentuais por cor", status: "pendente", prioridade: "alta", descricao: "Garantir percentuais corretos para cada variante." },
      // Stage 6: Amostras
      { secao_ordem: 5, titulo: "Solicitar amostra rodada 1", status: "concluida", prioridade: "alta", descricao: "Pedir 5 unidades de cada cor para avaliação." },
      { secao_ordem: 5, titulo: "Avaliar amostra rodada 1", status: "em_andamento", prioridade: "alta", descricao: "Checar cor, textura, fragrância e embalagem." },
      // Stage 7: Embalagem
      { secao_ordem: 6, titulo: "Definir materiais e acabamento", status: "em_andamento", prioridade: "alta", descricao: "Tubo translúcido, cap matte, emboss no logo." },
      { secao_ordem: 6, titulo: "Aprovar Pantone de referência", status: "pendente", prioridade: "media", descricao: "Validar cores com swatch físico e referência Pantone." },
      // Stage 8: Regulatório
      { secao_ordem: 7, titulo: "Submeter notificação ANVISA", status: "pendente", prioridade: "critica", descricao: "Preparar dossiê técnico para notificação." },
      { secao_ordem: 7, titulo: "Revisar textos legais do rótulo", status: "pendente", prioridade: "alta", descricao: "Verificar advertências, SAC, composição em português." },
      // Stage 9: Etiqueta/Bula
      { secao_ordem: 8, titulo: "Criar layout de etiqueta v1", status: "pendente", prioridade: "alta", descricao: "Desenvolver arte com informações regulatórias." },
      // Stage 10: Artes Finais
      { secao_ordem: 9, titulo: "Enviar arte para aprovação", status: "pendente", prioridade: "alta", descricao: "Submeter arte final no fluxo de aprovação." },
      // Stage 11: Aprovação Final
      { secao_ordem: 10, titulo: "Gate de aprovação diretoria", status: "pendente", prioridade: "critica", descricao: "Validação final antes de emitir OC." },
      // Stage 12: Produção
      { secao_ordem: 11, titulo: "Emitir Ordem de Compra", status: "pendente", prioridade: "alta", descricao: "Gerar OC após todas as aprovações." },
      { secao_ordem: 11, titulo: "Acompanhar produção e embarque", status: "pendente", prioridade: "media", descricao: "Monitorar apontamentos e tracking de container." },
    ];

    const { error: tarefaErr } = await supabase.from("projeto_tarefas").insert(
      tarefas.map((t, i) => ({
        projeto_id: projetoId,
        secao_id: secaoMap[t.secao_ordem],
        titulo: t.titulo,
        status: t.status,
        prioridade: t.prioridade,
        descricao: t.descricao,
        ordem: i,
        criador_id: userId,
        data_prazo: new Date(Date.now() + (i - 5) * 86400000 * 3).toISOString().split("T")[0],
      }))
    );
    if (tarefaErr) throw tarefaErr;

    // ─── 4. Create 3 Demo Submissões ───
    const submissoes = [
      { produto_codigo: "HID-BODY-001", produto_nome: "Hidratante Corporal Vanilla Bloom 200ml", status: "em_revisao" },
      { produto_codigo: "HID-HAND-002", produto_nome: "Creme para Mãos Coconut Glow 75ml", status: "rascunho" },
      { produto_codigo: "HID-LIP-003", produto_nome: "Lip Balm Tropical Mango 15g", status: "em_revisao" },
    ];

    const { data: subData, error: subErr } = await supabase
      .from("china_produto_submissoes")
      .insert(submissoes.map(s => ({ ...s, created_by: userId })))
      .select("id, produto_codigo, produto_nome");
    if (subErr) throw subErr;

    // Link submissions to project
    await supabase.from("china_submissao_projetos").insert(
      subData.map(s => ({ submissao_id: s.id, projeto_id: projetoId, created_by: userId }))
    );

    // ─── 5. Seed Composição (INCI) for product 1 ───
    const sub1 = subData[0].id;
    const composicaoItems = [
      { submissao_id: sub1, inci_name: "Aqua", nome_chines: "水", cas_no: "7732-18-5", funcao: "solvent", percentual_por_cor: { vanilla: 65, rosa: 65 }, status_anvisa: "conforme", versao: 1 },
      { submissao_id: sub1, inci_name: "Glycerin", nome_chines: "甘油", cas_no: "56-81-5", funcao: "moisturizer", percentual_por_cor: { vanilla: 8, rosa: 8 }, status_anvisa: "conforme", versao: 1 },
      { submissao_id: sub1, inci_name: "Cetearyl Alcohol", nome_chines: "鯨蠟硬脂醇", cas_no: "67762-27-0", funcao: "emollient", percentual_por_cor: { vanilla: 5, rosa: 5 }, status_anvisa: "conforme", versao: 1 },
      { submissao_id: sub1, inci_name: "Butyrospermum Parkii Butter", nome_chines: "乳木果油", cas_no: "194043-92-0", funcao: "skin_conditioning", percentual_por_cor: { vanilla: 4, rosa: 3 }, status_anvisa: "conforme", versao: 1 },
      { submissao_id: sub1, inci_name: "Parfum", nome_chines: "香精", cas_no: null, funcao: "fragrance", percentual_por_cor: { vanilla: 1.5, rosa: 1.2 }, status_anvisa: "atencao", observacao_anvisa: "Verificar presença de alérgenos na lista IFRA", versao: 1 },
      { submissao_id: sub1, inci_name: "Phenoxyethanol", nome_chines: "苯氧乙醇", cas_no: "122-99-6", funcao: "preservative", percentual_por_cor: { vanilla: 0.8, rosa: 0.8 }, status_anvisa: "conforme", versao: 1 },
      { submissao_id: sub1, inci_name: "CI 15985", nome_chines: "日落黄", cas_no: "2783-94-0", funcao: "colorant", percentual_por_cor: { vanilla: 0.01, rosa: 0 }, status_anvisa: "restrito", observacao_anvisa: "Corante restrito a 0.05% conforme RDC 2024", versao: 1 },
    ];
    await supabase.from("produto_composicao").insert(composicaoItems);

    // Composição version
    await supabase.from("produto_composicao_versoes").insert({
      submissao_id: sub1,
      versao: 1,
      status: "em_analise",
      submetido_por: userId,
      submetido_em: now,
      observacoes: "Versão inicial da composição INCI - pendente validação regulatória",
    });

    // ─── 6. Seed Amostras ───
    const checklistProduto1 = [
      { key: "embalagem_arte", label: "Embalagem física confere com arte aprovada?", resultado: "conforme", observacao: "OK, bisnaga translúcida correta" },
      { key: "cor_produto", label: "Cor do produto confere com padrão?", resultado: "conforme", observacao: "" },
      { key: "rotulo_info", label: "Rótulo com informações corretas?", resultado: "nao_conforme", observacao: "Faltou o número do SAC no rótulo" },
      { key: "formula_textura", label: "Produto interno (fórmula/textura) confere?", resultado: "conforme", observacao: "Textura cremosa, absorção rápida" },
      { key: "aplicador_acabamento", label: "Aplicador/acabamento confere?", resultado: "conforme", observacao: "" },
    ];

    await supabase.from("produto_amostras").insert([
      {
        submissao_id: sub1,
        numero_rodada: 1,
        data_solicitacao: new Date(Date.now() - 20 * 86400000).toISOString().split("T")[0],
        data_recebimento: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
        qtd_unidades: 5,
        qtd_cores: 2,
        checklist_resultado: checklistProduto1,
        status: "reprovada",
        instrucao_correcao: "Corrigir rótulo: incluir SAC 0800-123-4567 e endereço do importador conforme RDC 2024.",
        prazo_reenvio: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
        observacoes: "Amostra Rodada 1 — produto OK, embalagem com pendência no rótulo.",
        fotos: [],
        created_by: userId,
      },
      {
        submissao_id: subData[2].id,
        numero_rodada: 1,
        data_solicitacao: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0],
        qtd_unidades: 3,
        qtd_cores: 3,
        checklist_resultado: [],
        status: "aguardando_envio",
        observacoes: "Aguardando envio da fábrica — previsão 15 dias.",
        fotos: [],
        created_by: userId,
      },
    ]);

    // ─── 7. Seed Análise de Embalagem ───
    const { data: analiseData } = await supabase.from("produto_analise_embalagem").insert([
      {
        submissao_id: sub1,
        sku: "HID-BODY-001",
        produto_nome: "Hidratante Corporal Vanilla Bloom 200ml",
        linha_marca: "Banana Beauty - Hidratantes",
        tube_translucent: true,
        tube_shiny: false,
        cap_matte: true,
        finishing_embossed: true,
        finishing_translucent: true,
        colors_product_color: true,
        colors_white: false,
        status_aprovacao: "em_analise",
        fotos_referencia: [],
        created_by: userId,
      },
      {
        submissao_id: subData[2].id,
        sku: "HID-LIP-003",
        produto_nome: "Lip Balm Tropical Mango 15g",
        linha_marca: "Banana Beauty - Lip Care",
        tube_translucent: false,
        tube_shiny: true,
        cap_matte: false,
        cap_outro: "Cap rosqueável dourado",
        finishing_embossed: false,
        colors_product_color: true,
        status_aprovacao: "pendente",
        fotos_referencia: [],
        created_by: userId,
      },
    ]).select("id");

    // Add colors to first analysis
    if (analiseData?.[0]) {
      await supabase.from("produto_embalagem_cores").insert([
        { analise_id: analiseData[0].id, codigo_cor: "VAN-01", pantone_ref: "Pantone 7507 C", cor_hex: "#F5D6B0", ordem: 1 },
        { analise_id: analiseData[0].id, codigo_cor: "ROS-02", pantone_ref: "Pantone 1767 C", cor_hex: "#F4B4C6", ordem: 2 },
      ]);
    }

    // ─── 8. Seed Etiqueta/Bula ───
    await supabase.from("produto_etiqueta_bula").insert([
      {
        submissao_id: sub1,
        sku: "HID-BODY-001",
        produto_nome: "Hidratante Corporal Vanilla Bloom 200ml",
        linha_marca: "Banana Beauty",
        etapa_atual: "regulatorio",
        status_atual: "aguardando_regulatorio",
        numero_rodada: 2,
        double_sticker: true,
        finishing: "shiny",
        colors: "product_color",
        regulatorio_checklist: [
          { key: "inci_presente", label: "Composição INCI presente no rótulo?", resultado: "conforme" },
          { key: "anvisa_visivel", label: "Número ANVISA / notificação visível?", resultado: null },
          { key: "idioma_correto", label: "Idioma português correto?", resultado: "conforme" },
          { key: "peso_liquido", label: "Peso líquido informado?", resultado: "conforme" },
          { key: "prazo_validade", label: "Prazo de validade presente?", resultado: "conforme" },
          { key: "sac_endereco", label: "SAC / endereço fabricante?", resultado: "nao_conforme", observacao: "SAC não inserido" },
          { key: "advertencias", label: "Advertências legais?", resultado: null },
        ],
        aprovacoes: [
          { etapa: "criacao", status: "approved", responsavel_id: userId, data: new Date(Date.now() - 30 * 86400000).toISOString(), rodada: 1, descricao: "Layout base aprovado" },
          { etapa: "embalagem", status: "approved_with_changes", responsavel_id: userId, data: new Date(Date.now() - 20 * 86400000).toISOString(), rodada: 1, descricao: "Alterar fonte do peso líquido para 8pt" },
          { etapa: "desenvolvimento", status: "approved", responsavel_id: userId, data: new Date(Date.now() - 10 * 86400000).toISOString(), rodada: 2, descricao: "Composição atualizada corretamente" },
        ],
        historico_completo: [
          { etapa_de: "criacao", etapa_para: "embalagem", acao: "aprovado", data: new Date(Date.now() - 30 * 86400000).toISOString(), rodada: 1 },
          { etapa_de: "embalagem", etapa_para: "desenvolvimento", acao: "aprovado_com_alteracao", data: new Date(Date.now() - 20 * 86400000).toISOString(), rodada: 1 },
          { etapa_de: "desenvolvimento", etapa_para: "regulatorio", acao: "aprovado", data: new Date(Date.now() - 10 * 86400000).toISOString(), rodada: 2 },
        ],
        created_by: userId,
      },
      {
        submissao_id: subData[2].id,
        sku: "HID-LIP-003",
        produto_nome: "Lip Balm Tropical Mango 15g",
        linha_marca: "Banana Beauty",
        etapa_atual: "criacao",
        status_atual: "rascunho",
        numero_rodada: 1,
        regulatorio_checklist: [],
        aprovacoes: [],
        historico_completo: [],
        created_by: userId,
      },
    ]);

    // ─── 9. Seed Motor de Artes (produto_fluxo_artes) ───
    const { data: fluxoArtesData } = await supabase.from("produto_fluxo_artes").insert([
      {
        produto_id: sub1,
        sku: "HID-BODY-001",
        produto_nome: "Hidratante Corporal Vanilla Bloom 200ml",
        linha_marca: "Banana Beauty",
        tipo_checklist: "etiqueta_bula",
        etapa_atual: "desenvolvimento",
        status_geral: "em_andamento",
        numero_rodada: 2,
        fotos_referencia: [],
        aprovacoes: [
          { etapa: "criacao", status: "approved", responsavel_id: userId, data: new Date(Date.now() - 25 * 86400000).toISOString(), rodada: 1 },
          { etapa: "embalagem", status: "approved", responsavel_id: userId, data: new Date(Date.now() - 15 * 86400000).toISOString(), rodada: 1 },
        ],
        regulatorio_checklist: [],
        historico: [
          { etapa_de: "criacao", etapa_para: "embalagem", acao: "aprovado", data: new Date(Date.now() - 25 * 86400000).toISOString(), rodada: 1 },
          { etapa_de: "embalagem", etapa_para: "desenvolvimento", acao: "aprovado", data: new Date(Date.now() - 15 * 86400000).toISOString(), rodada: 1 },
        ],
        campos_especificos: { double_sticker: true, finishing: "shiny", colors: "product_color" },
        created_by: userId,
      },
      {
        produto_id: subData[1].id,
        sku: "HID-HAND-002",
        produto_nome: "Creme para Mãos Coconut Glow 75ml",
        linha_marca: "Banana Beauty",
        tipo_checklist: "tester",
        etapa_atual: "criacao",
        status_geral: "em_andamento",
        numero_rodada: 1,
        fotos_referencia: [],
        aprovacoes: [],
        regulatorio_checklist: [],
        historico: [],
        campos_especificos: { tipo_tester: "expositor", quantidade_unidades: 6, material_tester: "Acrílico transparente" },
        created_by: userId,
      },
    ]).select("id");

    // Add colors to fluxo artes
    if (fluxoArtesData?.[0]) {
      await supabase.from("produto_fluxo_artes_cores").insert([
        { fluxo_id: fluxoArtesData[0].id, codigo_cor: "VAN-01", pantone_ref: "Pantone 7507 C", cor_hex: "#F5D6B0", ordem: 1 },
        { fluxo_id: fluxoArtesData[0].id, codigo_cor: "ROS-02", pantone_ref: "Pantone 1767 C", cor_hex: "#F4B4C6", ordem: 2 },
      ]);
    }

    // ─── 10. Seed Fluxo de Aprovação de Artes ───
    const { data: configData } = await supabase.from("fluxo_aprovacao_config").insert({
      nome: "Aprovação Etiqueta Hidratantes",
      checklist_tipo: "etiqueta_bula",
      descricao: "Fluxo padrão de aprovação de etiqueta para linha de hidratantes. Criação → Embalagem → Regulatório → Arte Final.",
      ativo: true,
      created_by: userId,
    }).select("id").single();

    if (configData) {
      // Create approval stages
      const { data: etapasData } = await supabase.from("fluxo_aprovacao_etapas").insert([
        { config_id: configData.id, nome: "Criação / Design", nome_cn: "设计创作", ordem: 1, tipo_aprovacao: "simples", responsavel_id: userId, ativo: true },
        { config_id: configData.id, nome: "Validação Embalagem", nome_cn: "包装验证", ordem: 2, tipo_aprovacao: "simples", responsavel_id: userId, ativo: true },
        { config_id: configData.id, nome: "Análise Regulatória", nome_cn: "法规审查", ordem: 3, tipo_aprovacao: "paralela", responsavel_id: userId, ativo: true },
        { config_id: configData.id, nome: "Arte Final Aprovada", nome_cn: "最终版批准", ordem: 4, tipo_aprovacao: "simples", responsavel_id: userId, ativo: true },
      ]).select("id, ordem");

      // Create an instance in progress
      const { data: instancia } = await supabase.from("fluxo_aprovacao_instancias").insert({
        config_id: configData.id,
        submissao_id: sub1,
        etapa_atual_ordem: 2,
        status: "em_andamento",
        rodada: 1,
        created_by: userId,
      }).select("id").single();

      if (instancia && etapasData) {
        // Add transition history
        await supabase.from("fluxo_aprovacao_transicoes").insert([
          { instancia_id: instancia.id, etapa_id: etapasData[0].id, etapa_nome: "Criação / Design", usuario_id: userId, acao: "aprovado", observacao: "Design aprovado conforme briefing", rodada: 1 },
        ]);
      }
    }

    // ─── 11. Create China Ordens de Compra (demo) ───
    await supabase.from("china_ordens_compra").insert({
      submissao_id: sub1,
      numero_oc: "OC-2026-DEMO-001",
      produto_codigo: "HID-BODY-001",
      produto_nome: "Hidratante Corporal Vanilla Bloom 200ml",
      qty_total: 5000,
      qty_produzida: 0,
      status: "pendente_aprovacao",
      data_emissao: new Date().toISOString().split("T")[0],
      data_entrega_prevista: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      observacoes: "OC demonstrativa — aguardando aprovação do gate final.",
      created_by: userId,
    });

    // ─── 12. Seed Cores do Produto (china_produto_cores) ───
    await supabase.from("china_produto_cores").insert([
      { submissao_id: sub1, cor_nome: "Vanilla Bloom", cor_numero: "VAN-01", cor_hex: "#F5D6B0", grupo: "Neutros", quantidade: 3000, ordem: 1 },
      { submissao_id: sub1, cor_nome: "Rose Petal", cor_numero: "ROS-02", cor_hex: "#F4B4C6", grupo: "Rosados", quantidade: 2000, ordem: 2 },
      { submissao_id: subData[2].id, cor_nome: "Mango Sunrise", cor_numero: "MNG-01", cor_hex: "#FFB347", grupo: "Tropicais", quantidade: 1500, ordem: 1 },
      { submissao_id: subData[2].id, cor_nome: "Guava Pink", cor_numero: "GUA-02", cor_hex: "#FF6B81", grupo: "Tropicais", quantidade: 1000, ordem: 2 },
      { submissao_id: subData[2].id, cor_nome: "Coconut Cream", cor_numero: "COC-03", cor_hex: "#FFF5E6", grupo: "Neutros", quantidade: 500, ordem: 3 },
    ]);

    return new Response(JSON.stringify({
      success: true,
      message: "Dados de simulação criados com sucesso!",
      data: {
        projeto_id: projetoId,
        submissoes: subData.length,
        composicao_items: composicaoItems.length,
        secoes: secoesData.length,
        tarefas: tarefas.length,
      }
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

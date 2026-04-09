import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

interface Inconsistencia {
  id: string;
  tipo: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  categoria: 'seguranca' | 'financeiro' | 'operacional' | 'conformidade';
  titulo: string;
  descricao: string;
  fornecedor: string;
  documento: string;
  dados: Record<string, any>;
  recomendacao: string;
}

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 30,
  rateLimitPrefix: "auditoria-cp",
}, async (req, _ctx) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, limit = 5000, filters } = await req.json();

    console.log("[Auditoria CP] Iniciando análise completa de Contas a Pagar...");

    // Buscar contas a pagar
    let query = supabase
      .from("contas_pagar")
      .select("*")
      .order("data_vencimento", { ascending: false });

    if (filters?.ano) {
      query = query.gte('data_vencimento', `${filters.ano}-01-01`)
                   .lte('data_vencimento', `${filters.ano}-12-31`);
    }

    const { data: contas, error } = await query.limit(limit);

    if (error) throw error;

    const inconsistencias: Inconsistencia[] = [];

    // Mapear fornecedores para detectar duplicidades
    const fornecedoresPorNome = new Map<string, any[]>();

    for (const conta of contas || []) {
      // Agrupar por fornecedor para análise posterior
      const nomeNormalizado = (conta.fornecedor_nome || '').toLowerCase().trim();
      if (nomeNormalizado) {
        if (!fornecedoresPorNome.has(nomeNormalizado)) {
          fornecedoresPorNome.set(nomeNormalizado, []);
        }
        fornecedoresPorNome.get(nomeNormalizado)!.push(conta);
      }

      // ===== ANÁLISES DE SEGURANÇA =====

      // 1. Pagamento sem documento fiscal válido
      if (conta.status === 'pago' && (!conta.numero_documento || conta.numero_documento.length < 3)) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'pagamento_sem_documento',
          severidade: 'critica',
          categoria: 'seguranca',
          titulo: 'Pagamento sem documento fiscal',
          descricao: `Conta paga de R$ ${conta.valor_pago?.toFixed(2)} sem número de documento válido`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'AUSENTE',
          dados: { valor_pago: conta.valor_pago, data_pagamento: conta.data_pagamento },
          recomendacao: 'Verificar comprovante de pagamento e documento fiscal junto ao fornecedor'
        });
      }

      // 2. Fornecedor sem identificação (possível fraude)
      if (!conta.fornecedor_codigo && !conta.fornecedor_nome) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'fornecedor_nao_identificado',
          severidade: 'critica',
          categoria: 'seguranca',
          titulo: 'Fornecedor não identificado',
          descricao: `Conta de R$ ${conta.valor_original?.toFixed(2)} sem identificação do fornecedor`,
          fornecedor: 'NÃO IDENTIFICADO',
          documento: conta.numero_documento || 'N/A',
          dados: { valor_original: conta.valor_original },
          recomendacao: 'URGENTE: Identificar fornecedor antes de qualquer pagamento. Possível tentativa de fraude.'
        });
      }

      // 3. Valor muito alto (acima de R$ 500.000) - requer aprovação especial
      if (conta.valor_original && conta.valor_original > 500000) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'valor_alto_aprovacao',
          severidade: 'alta',
          categoria: 'seguranca',
          titulo: 'Valor requer aprovação especial',
          descricao: `Conta de R$ ${conta.valor_original?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} acima do limite de alçada`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { valor_original: conta.valor_original },
          recomendacao: 'Verificar se há aprovação de diretoria documentada para este pagamento'
        });
      }

      // ===== ANÁLISES FINANCEIRAS =====

      // 4. Valor pago divergente do original (diferença > 5%)
      if (conta.status === 'pago' && conta.valor_pago && conta.valor_original) {
        const diferenca = Math.abs(conta.valor_pago - conta.valor_original);
        const percentual = (diferenca / conta.valor_original) * 100;
        
        if (percentual > 5 && diferenca > 100) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'valor_divergente',
            severidade: percentual > 20 ? 'alta' : 'media',
            categoria: 'financeiro',
            titulo: 'Divergência no valor pago',
            descricao: `Diferença de ${percentual.toFixed(1)}% entre valor original (R$ ${conta.valor_original?.toFixed(2)}) e pago (R$ ${conta.valor_pago?.toFixed(2)})`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { valor_original: conta.valor_original, valor_pago: conta.valor_pago, diferenca, percentual },
            recomendacao: 'Verificar se houve desconto, multa ou erro no pagamento'
          });
        }
      }

      // 5. Valor em aberto negativo (crédito não registrado?)
      if (conta.valor_aberto && conta.valor_aberto < 0) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'valor_negativo',
          severidade: 'alta',
          categoria: 'financeiro',
          titulo: 'Saldo negativo (crédito a recuperar)',
          descricao: `Valor em aberto de R$ ${conta.valor_aberto?.toFixed(2)} indica pagamento a maior ou crédito`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { valor_aberto: conta.valor_aberto, valor_original: conta.valor_original },
          recomendacao: 'Solicitar nota de crédito ou compensar em próximas faturas'
        });
      }

      // 6. Juros e multas altos (acima de 10% do valor)
      if (conta.valor_juros && conta.valor_original) {
        const percentualJuros = (conta.valor_juros / conta.valor_original) * 100;
        if (percentualJuros > 10) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'juros_elevados',
            severidade: 'media',
            categoria: 'financeiro',
            titulo: 'Juros/Multas elevados',
            descricao: `Juros de R$ ${conta.valor_juros?.toFixed(2)} representam ${percentualJuros.toFixed(1)}% do valor original`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { valor_juros: conta.valor_juros, valor_original: conta.valor_original, percentualJuros },
            recomendacao: 'Negociar condições de pagamento e implementar controles de vencimento'
          });
        }
      }

      // ===== ANÁLISES OPERACIONAIS =====

      // 7. Data de pagamento anterior à emissão
      if (conta.data_pagamento && conta.data_emissao) {
        const dataPagamento = new Date(conta.data_pagamento);
        const dataEmissao = new Date(conta.data_emissao);
        
        if (dataPagamento < dataEmissao) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'data_pagamento_invalida',
            severidade: 'critica',
            categoria: 'operacional',
            titulo: 'Pagamento antes da emissão',
            descricao: `Pagamento em ${conta.data_pagamento} é anterior à emissão em ${conta.data_emissao}`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { data_emissao: conta.data_emissao, data_pagamento: conta.data_pagamento },
            recomendacao: 'ERRO GRAVE: Verificar integridade dos dados. Possível retroação de lançamento.'
          });
        }
      }

      // 8. Vencimento antes da emissão
      if (conta.data_vencimento && conta.data_emissao) {
        const dataVencimento = new Date(conta.data_vencimento);
        const dataEmissao = new Date(conta.data_emissao);
        
        if (dataVencimento < dataEmissao) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'vencimento_antes_emissao',
            severidade: 'alta',
            categoria: 'operacional',
            titulo: 'Vencimento anterior à emissão',
            descricao: `Vencimento em ${conta.data_vencimento} é anterior à emissão em ${conta.data_emissao}`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { data_emissao: conta.data_emissao, data_vencimento: conta.data_vencimento },
            recomendacao: 'Corrigir data de vencimento junto ao fornecedor'
          });
        }
      }

      // 9. Prazo de vencimento muito longo (> 365 dias)
      if (conta.data_vencimento && conta.data_emissao) {
        const dataVencimento = new Date(conta.data_vencimento);
        const dataEmissao = new Date(conta.data_emissao);
        const diffDays = Math.floor((dataVencimento.getTime() - dataEmissao.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'prazo_excessivo',
            severidade: 'media',
            categoria: 'operacional',
            titulo: 'Prazo de pagamento excessivo',
            descricao: `Vencimento em ${Math.round(diffDays/30)} meses (${diffDays} dias) após emissão`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { data_emissao: conta.data_emissao, data_vencimento: conta.data_vencimento, dias_prazo: diffDays },
            recomendacao: 'Verificar termos do contrato e política de prazos'
          });
        }
      }

      // 10. Conta sem classificação contábil
      if (!conta.plano_contas_id && !conta.departamento_id && conta.valor_original && conta.valor_original > 1000) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'sem_classificacao',
          severidade: 'media',
          categoria: 'conformidade',
          titulo: 'Sem classificação contábil',
          descricao: `Conta de R$ ${conta.valor_original?.toFixed(2)} sem departamento ou plano de contas`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { valor_original: conta.valor_original },
          recomendacao: 'Classificar para correta alocação no DRE'
        });
      }

      // 11. Contas vencidas há mais de 90 dias sem pagamento
      if (conta.data_vencimento && conta.status !== 'pago') {
        const hoje = new Date();
        const dataVenc = new Date(conta.data_vencimento);
        const diasAtraso = Math.floor((hoje.getTime() - dataVenc.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diasAtraso > 90) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'atraso_critico',
            severidade: diasAtraso > 180 ? 'critica' : 'alta',
            categoria: 'financeiro',
            titulo: 'Atraso crítico no pagamento',
            descricao: `Conta vencida há ${diasAtraso} dias com saldo de R$ ${conta.valor_aberto?.toFixed(2)}`,
            fornecedor: conta.fornecedor_nome || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: { dias_atraso: diasAtraso, valor_aberto: conta.valor_aberto, data_vencimento: conta.data_vencimento },
            recomendacao: diasAtraso > 180 
              ? 'URGENTE: Negociar acordo. Risco de protesto e ação judicial.'
              : 'Priorizar pagamento ou negociar parcelamento'
          });
        }
      }

      // 12. Status pago mas com valor em aberto
      if (conta.status === 'pago' && conta.valor_aberto && conta.valor_aberto > 1) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'status_inconsistente',
          severidade: 'alta',
          categoria: 'operacional',
          titulo: 'Status inconsistente',
          descricao: `Marcado como pago mas com R$ ${conta.valor_aberto?.toFixed(2)} em aberto`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { status: conta.status, valor_aberto: conta.valor_aberto },
          recomendacao: 'Corrigir status ou registrar pagamento complementar'
        });
      }

      // 13. Valor muito pequeno (possível taxa de serviço não identificada)
      if (conta.valor_original && conta.valor_original > 0 && conta.valor_original < 10 && !conta.fornecedor_nome?.toLowerCase().includes('tarifa')) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'valor_micro',
          severidade: 'baixa',
          categoria: 'operacional',
          titulo: 'Valor micro não identificado',
          descricao: `Valor de R$ ${conta.valor_original?.toFixed(2)} pode ser taxa ou erro de digitação`,
          fornecedor: conta.fornecedor_nome || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { valor_original: conta.valor_original },
          recomendacao: 'Verificar natureza da despesa e classificar adequadamente'
        });
      }
    }

    // 14. Análise de duplicidades
    const duplicatas: any[] = [];
    for (const [_, contasDoFornecedor] of fornecedoresPorNome.entries()) {
      if (contasDoFornecedor.length > 1) {
        // Agrupar por valor e data
        const grupos = new Map<string, any[]>();
        for (const c of contasDoFornecedor) {
          const key = `${c.valor_original}_${c.data_emissao}`;
          if (!grupos.has(key)) grupos.set(key, []);
          grupos.get(key)!.push(c);
        }
        
        for (const [_, grupo] of grupos.entries()) {
          if (grupo.length > 1) {
            const primeiroId = grupo[0].id;
            if (!inconsistencias.some(i => i.id === primeiroId && i.tipo === 'duplicidade')) {
              inconsistencias.push({
                id: primeiroId,
                tipo: 'duplicidade',
                severidade: 'critica',
                categoria: 'seguranca',
                titulo: 'Possível pagamento duplicado',
                descricao: `${grupo.length} contas idênticas: mesmo fornecedor, valor e data de emissão`,
                fornecedor: grupo[0].fornecedor_nome || 'N/A',
                documento: grupo.map(g => g.numero_documento).join(', '),
                dados: { 
                  quantidade: grupo.length, 
                  valor_unitario: grupo[0].valor_original,
                  valor_total: grupo[0].valor_original * grupo.length,
                  ids: grupo.map(g => g.id)
                },
                recomendacao: 'URGENTE: Verificar se são documentos distintos ou duplicidade. Risco de perda financeira.'
              });
            }
          }
        }
      }
    }

    // Estatísticas detalhadas
    const estatisticas = {
      total_analisados: contas?.length || 0,
      total_inconsistencias: inconsistencias.length,
      valor_total_analisado: contas?.reduce((sum, c) => sum + (c.valor_original || 0), 0) || 0,
      valor_em_risco: inconsistencias
        .filter(i => ['critica', 'alta'].includes(i.severidade))
        .reduce((sum, i) => sum + (i.dados.valor_original || i.dados.valor_aberto || 0), 0),
      por_severidade: {
        critica: inconsistencias.filter(i => i.severidade === 'critica').length,
        alta: inconsistencias.filter(i => i.severidade === 'alta').length,
        media: inconsistencias.filter(i => i.severidade === 'media').length,
        baixa: inconsistencias.filter(i => i.severidade === 'baixa').length
      },
      por_categoria: {
        seguranca: inconsistencias.filter(i => i.categoria === 'seguranca').length,
        financeiro: inconsistencias.filter(i => i.categoria === 'financeiro').length,
        operacional: inconsistencias.filter(i => i.categoria === 'operacional').length,
        conformidade: inconsistencias.filter(i => i.categoria === 'conformidade').length
      },
      por_tipo: inconsistencias.reduce((acc, i) => {
        acc[i.tipo] = (acc[i.tipo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log(`[Auditoria CP] Análise concluída: ${inconsistencias.length} inconsistências em ${contas?.length} contas`);

    // Análise com IA
    if (action === 'ai_analysis') {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({
          success: false,
          error: "LOVABLE_API_KEY não configurada"
        }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
      }

      const topInconsistencias = inconsistencias
        .sort((a, b) => {
          const ordemSeveridade = { critica: 0, alta: 1, media: 2, baixa: 3 };
          return ordemSeveridade[a.severidade] - ordemSeveridade[b.severidade];
        })
        .slice(0, 30);
      
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um AUDITOR FINANCEIRO SÊNIOR e ESPECIALISTA EM SEGURANÇA CORPORATIVA.

## SEU PAPEL
Você analisa Contas a Pagar para identificar:
- Fraudes e tentativas de desvio
- Erros operacionais e sistêmicos
- Riscos financeiros e de compliance
- Oportunidades de melhoria de processos

## ESTRUTURA DO RELATÓRIO (OBRIGATÓRIA)

### 1. 🔴 ALERTAS CRÍTICOS
- Liste APENAS os itens de severidade CRÍTICA
- Formato: bullet points diretos com ação recomendada
- Se não houver críticos, escreva "Nenhum alerta crítico identificado"

### 2. 📊 RESUMO EXECUTIVO
- Visão geral em 3-4 linhas
- Percentual de registros com problemas
- Valor financeiro em risco

### 3. 🛡️ ANÁLISE DE SEGURANÇA
- Possíveis fraudes identificadas
- Controles ausentes ou falhos
- Fornecedores suspeitos

### 4. 💰 IMPACTO FINANCEIRO
Apresente um gráfico de valores em risco:
\`\`\`chart
{"type":"bar","title":"Valores em Risco por Categoria","data":[...]}
\`\`\`

### 5. 📈 DISTRIBUIÇÃO DE RISCOS
Gráfico de severidade:
\`\`\`chart
{"type":"pie","title":"Distribuição por Severidade","data":[{"name":"Crítica","value":X},{"name":"Alta","value":Y},...]}
\`\`\`

### 6. 🔧 PLANO DE AÇÃO PRIORITÁRIO
Tabela com:
| Prioridade | Ação | Responsável Sugerido | Prazo |
|------------|------|---------------------|-------|

### 7. 📋 RECOMENDAÇÕES DE CONTROLE
- Controles preventivos a implementar
- Melhorias de processo
- Automatizações sugeridas

### 8. ✅ CONCLUSÃO
- Nota de risco geral (1-10)
- Parecer do auditor

## REGRAS
- Seja DIRETO e PROFISSIONAL
- Use dados numéricos específicos
- Sempre inclua os gráficos no formato especificado
- Foque em AÇÃO, não apenas diagnóstico
- Responda em Português do Brasil`
            },
            {
              role: "user",
              content: `AUDITORIA DE CONTAS A PAGAR

## ESTATÍSTICAS DA ANÁLISE
- Total de contas analisadas: ${estatisticas.total_analisados}
- Valor total analisado: R$ ${estatisticas.valor_total_analisado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Total de inconsistências: ${estatisticas.total_inconsistencias}
- Valor estimado em risco: R$ ${estatisticas.valor_em_risco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

## DISTRIBUIÇÃO POR SEVERIDADE
- Crítica: ${estatisticas.por_severidade.critica}
- Alta: ${estatisticas.por_severidade.alta}
- Média: ${estatisticas.por_severidade.media}
- Baixa: ${estatisticas.por_severidade.baixa}

## DISTRIBUIÇÃO POR CATEGORIA
- Segurança: ${estatisticas.por_categoria.seguranca}
- Financeiro: ${estatisticas.por_categoria.financeiro}
- Operacional: ${estatisticas.por_categoria.operacional}
- Conformidade: ${estatisticas.por_categoria.conformidade}

## TIPOS DE INCONSISTÊNCIAS
${JSON.stringify(estatisticas.por_tipo, null, 2)}

## AMOSTRA DAS PRINCIPAIS INCONSISTÊNCIAS (ordenadas por severidade)
${JSON.stringify(topInconsistencias, null, 2)}

Gere o relatório de auditoria completo seguindo a estrutura definida.`
            }
          ]
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("[Auditoria CP] Erro da IA:", errorText);
        
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({
            success: false,
            error: "Rate limit excedido. Tente novamente em alguns minutos."
          }), {
            status: 429,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
          });
        }
        
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({
            success: false,
            error: "Créditos de IA insuficientes. Entre em contato com o administrador."
          }), {
            status: 402,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
          });
        }

        throw new Error(`Erro da IA: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const analiseIA = aiData.choices?.[0]?.message?.content;
      
      return new Response(JSON.stringify({
        success: true,
        inconsistencias,
        estatisticas,
        analise_ia: analiseIA,
        data_analise: new Date().toISOString()
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }

    // Retorno sem IA
    return new Response(JSON.stringify({
      success: true,
      inconsistencias,
      estatisticas,
      data_analise: new Date().toISOString()
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });

  } catch (err) {
    const error = err as Error;
    console.error("[Auditoria CP] Erro:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }
}));

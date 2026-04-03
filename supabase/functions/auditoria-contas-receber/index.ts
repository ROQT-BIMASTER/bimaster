import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


interface Inconsistencia {
  id: string;
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  cliente: string;
  documento: string;
  dados: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, limit = 1000 } = await req.json();

    console.log("[Auditoria CR] Iniciando análise de inconsistências...");

    // Buscar contas a receber
    const { data: contas, error } = await supabase
      .from("contas_receber")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const inconsistencias: Inconsistencia[] = [];

    for (const conta of contas || []) {
      // 1. Valor recebido diferente do original (com tolerância de 1%)
      if (conta.status === 'recebido' && conta.valor_recebido && conta.valor_original) {
        const diferenca = Math.abs(conta.valor_recebido - conta.valor_original);
        const percentual = (diferenca / conta.valor_original) * 100;
        
        if (percentual > 1 && diferenca > 10) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'valor_divergente',
            severidade: percentual > 10 ? 'alta' : 'media',
            titulo: 'Valor recebido divergente',
            descricao: `Diferença de ${percentual.toFixed(1)}% entre valor original (R$ ${conta.valor_original?.toFixed(2)}) e recebido (R$ ${conta.valor_recebido?.toFixed(2)})`,
            cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: {
              valor_original: conta.valor_original,
              valor_recebido: conta.valor_recebido,
              diferenca: diferenca,
              percentual: percentual
            }
          });
        }
      }

      // 2. Data de pagamento anterior à data de emissão
      if (conta.data_recebimento && conta.data_emissao) {
        const dataRecebimento = new Date(conta.data_recebimento);
        const dataEmissao = new Date(conta.data_emissao);
        
        if (dataRecebimento < dataEmissao) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'data_pagamento_invalida',
            severidade: 'alta',
            titulo: 'Pagamento antes da emissão',
            descricao: `Data de recebimento (${conta.data_recebimento}) é anterior à data de emissão (${conta.data_emissao})`,
            cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: {
              data_emissao: conta.data_emissao,
              data_recebimento: conta.data_recebimento
            }
          });
        }
      }

      // 3. Vencimento maior que 6 meses da emissão
      if (conta.data_vencimento && conta.data_emissao) {
        const dataVencimento = new Date(conta.data_vencimento);
        const dataEmissao = new Date(conta.data_emissao);
        const diffDays = Math.floor((dataVencimento.getTime() - dataEmissao.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 180) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'prazo_longo',
            severidade: diffDays > 365 ? 'alta' : 'media',
            titulo: 'Prazo de vencimento muito longo',
            descricao: `Vencimento ${diffDays} dias após emissão (${Math.round(diffDays/30)} meses)`,
            cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: {
              data_emissao: conta.data_emissao,
              data_vencimento: conta.data_vencimento,
              dias_prazo: diffDays
            }
          });
        }
      }

      // 4. Data de vencimento anterior à data de emissão
      if (conta.data_vencimento && conta.data_emissao) {
        const dataVencimento = new Date(conta.data_vencimento);
        const dataEmissao = new Date(conta.data_emissao);
        
        if (dataVencimento < dataEmissao) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'vencimento_antes_emissao',
            severidade: 'alta',
            titulo: 'Vencimento antes da emissão',
            descricao: `Data de vencimento (${conta.data_vencimento}) é anterior à data de emissão (${conta.data_emissao})`,
            cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: {
              data_emissao: conta.data_emissao,
              data_vencimento: conta.data_vencimento
            }
          });
        }
      }

      // 5. Valor em aberto negativo
      if (conta.valor_aberto && conta.valor_aberto < 0) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'valor_negativo',
          severidade: 'alta',
          titulo: 'Valor em aberto negativo',
          descricao: `Título com valor em aberto de R$ ${conta.valor_aberto?.toFixed(2)}`,
          cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: {
            valor_aberto: conta.valor_aberto,
            valor_original: conta.valor_original
          }
        });
      }

      // 6. Dias de atraso muito alto sem cobrança
      if (conta.dias_atraso && conta.dias_atraso > 90 && conta.status !== 'recebido') {
        inconsistencias.push({
          id: conta.id,
          tipo: 'atraso_critico',
          severidade: conta.dias_atraso > 180 ? 'alta' : 'media',
          titulo: 'Atraso crítico sem resolução',
          descricao: `Título com ${conta.dias_atraso} dias de atraso e valor de R$ ${conta.valor_aberto?.toFixed(2)}`,
          cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: {
            dias_atraso: conta.dias_atraso,
            valor_aberto: conta.valor_aberto,
            data_vencimento: conta.data_vencimento
          }
        });
      }

      // 7. Título sem data de emissão
      if (!conta.data_emissao) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'dados_incompletos',
          severidade: 'baixa',
          titulo: 'Data de emissão ausente',
          descricao: 'Título sem data de emissão preenchida',
          cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: { ...conta }
        });
      }

      // 8. Título recebido mas com valor em aberto > 0
      if (conta.status === 'recebido' && conta.valor_aberto && conta.valor_aberto > 0.01) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'status_inconsistente',
          severidade: 'media',
          titulo: 'Status recebido com valor em aberto',
          descricao: `Título marcado como recebido mas com R$ ${conta.valor_aberto?.toFixed(2)} em aberto`,
          cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: {
            status: conta.status,
            valor_aberto: conta.valor_aberto
          }
        });
      }

      // 9. Valor original muito alto (possível erro de digitação)
      if (conta.valor_original && conta.valor_original > 10000000) {
        inconsistencias.push({
          id: conta.id,
          tipo: 'valor_suspeito',
          severidade: 'alta',
          titulo: 'Valor suspeito (muito alto)',
          descricao: `Valor original de R$ ${conta.valor_original?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pode indicar erro de digitação`,
          cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
          documento: conta.numero_documento || 'N/A',
          dados: {
            valor_original: conta.valor_original
          }
        });
      }

      // 10. Duplicidade potencial (mesmo cliente, mesmo valor, mesma data)
      const duplicatas = (contas || []).filter(c => 
        c.id !== conta.id &&
        c.cliente_codigo === conta.cliente_codigo &&
        c.valor_original === conta.valor_original &&
        c.data_emissao === conta.data_emissao
      );
      
      if (duplicatas.length > 0) {
        // Só adicionar uma vez para o primeiro da duplicidade
        const jaAdicionado = inconsistencias.some(i => 
          i.tipo === 'duplicidade' && 
          i.dados.grupo_ids?.includes(conta.id)
        );
        
        if (!jaAdicionado) {
          inconsistencias.push({
            id: conta.id,
            tipo: 'duplicidade',
            severidade: 'alta',
            titulo: 'Possível duplicidade',
            descricao: `${duplicatas.length + 1} títulos com mesmo cliente, valor e data de emissão`,
            cliente: conta.cliente_nome || conta.cliente_codigo || 'N/A',
            documento: conta.numero_documento || 'N/A',
            dados: {
              grupo_ids: [conta.id, ...duplicatas.map(d => d.id)],
              quantidade: duplicatas.length + 1
            }
          });
        }
      }
    }

    // Estatísticas
    const estatisticas = {
      total_analisados: contas?.length || 0,
      total_inconsistencias: inconsistencias.length,
      por_severidade: {
        alta: inconsistencias.filter(i => i.severidade === 'alta').length,
        media: inconsistencias.filter(i => i.severidade === 'media').length,
        baixa: inconsistencias.filter(i => i.severidade === 'baixa').length
      },
      por_tipo: inconsistencias.reduce((acc, i) => {
        acc[i.tipo] = (acc[i.tipo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log(`[Auditoria CR] Análise concluída: ${inconsistencias.length} inconsistências encontradas`);

    // Se solicitado análise com IA
    if (action === 'ai_analysis' && inconsistencias.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        const topInconsistencias = inconsistencias.slice(0, 20);
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              {
                role: "system",
                content: `Você é um auditor financeiro sênior especializado em contas a receber e gestão de riscos.

## SUAS CAPACIDADES:
- Análise detalhada de inconsistências financeiras
- Identificação de padrões de fraude e erros sistêmicos
- Geração de relatórios de auditoria profissionais
- Criação de gráficos para visualização de riscos
- Recomendações de controles internos

## FORMATO DE GRÁFICOS:
\`\`\`chart
{"type":"bar|line|pie|area","title":"Título","data":[{"name":"Label","value":123}]}
\`\`\`

## ESTRUTURA DO RELATÓRIO:
1. **Resumo Executivo** - Visão geral da situação
2. **Análise de Riscos** - Classificação por severidade com gráfico
3. **Padrões Identificados** - Tendências e correlações
4. **Impacto Financeiro** - Valores envolvidos
5. **Recomendações** - Ações prioritárias ordenadas
6. **Próximos Passos** - Cronograma sugerido

Use linguagem profissional, seja analítico e objetivo.`
              },
              {
                role: "user",
                content: `Analise estas ${inconsistencias.length} inconsistências encontradas em contas a receber:

Estatísticas:
${JSON.stringify(estatisticas, null, 2)}

Amostra das principais inconsistências:
${JSON.stringify(topInconsistencias, null, 2)}`
              }
            ]
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const analiseIA = aiData.choices?.[0]?.message?.content;
          
          return new Response(JSON.stringify({
            success: true,
            inconsistencias,
            estatisticas,
            analise_ia: analiseIA
          }), {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inconsistencias,
      estatisticas
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });

  } catch (err) {
    const error = err as Error;
    console.error("[Auditoria CR] Erro:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }
});

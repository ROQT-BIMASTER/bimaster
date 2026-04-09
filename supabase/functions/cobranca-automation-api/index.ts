import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";


// Authenticate request - supports both JWT and API key
async function authenticateRequest(req: Request, supabase: any): Promise<{ authenticated: boolean; userId?: string; isN8N?: boolean }> {
  // Check for N8N API key (supports multiple key sources)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const validKeys = [
      Deno.env.get("N8N_API_KEY"),
      Deno.env.get("COBRANCA_API_KEY"),
      Deno.env.get("POLLO_API_KEY"),
    ].filter(Boolean);
    
    if (validKeys.includes(apiKey)) {
      console.log(`[Auth] API key autenticada com sucesso`);
      return { authenticated: true, isN8N: true };
    }
    console.warn(`[Auth] API key inválida fornecida`);
  }

  // Check for JWT
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!error && user) {
      return { authenticated: true, userId: user.id };
    }
  }

  return { authenticated: false };
}

// Replace template variables with actual values
function processTemplate(template: string, data: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value?.toString() || '');
  }
  return result;
}

// Format currency for Brazilian Real
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Format date for Brazilian format
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 60,
  rateLimitPrefix: "cobranca-api",
}, async (req, _ctx) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // ============ ENFILEIRAR - Add to collection queue ============
    if (path === "enfileirar" && req.method === "POST") {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { cliente_codigo, cliente_nome, cliente_email, cliente_telefone, conta_receber_id, canal, template_id, mensagem_personalizada, agendado_para, prioridade, dados_adicionais } = body;

      if (!cliente_codigo || !canal) {
        return new Response(JSON.stringify({ error: "cliente_codigo e canal são obrigatórios" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Get template if provided
      let templateNome = null;
      if (template_id) {
        const { data: template } = await supabase
          .from("templates_cobranca")
          .select("nome")
          .eq("id", template_id)
          .single();
        templateNome = template?.nome;
      }

      const { data, error } = await supabase
        .from("fila_cobrancas")
        .insert({
          cliente_codigo,
          cliente_nome,
          cliente_email,
          cliente_telefone,
          conta_receber_id,
          canal,
          template_id,
          template_nome: templateNome,
          mensagem_personalizada,
          agendado_para: agendado_para || new Date().toISOString(),
          prioridade: prioridade || 5,
          dados_adicionais: dados_adicionais || {},
          criado_por: auth.userId,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[Cobrança] Enfileirado: ${cliente_codigo} via ${canal}`);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ PENDENTES - Get pending items for N8N ============
    if (path === "pendentes" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const limit = parseInt(url.searchParams.get("limit") || "50");
      const canal = url.searchParams.get("canal");

      let query = supabase
        .from("fila_cobrancas")
        .select(`
          *,
          template:templates_cobranca(nome, canal, assunto, conteudo)
        `)
        .eq("status", "pendente")
        .lte("agendado_para", new Date().toISOString())
        .lt("tentativas", supabase.rpc("greatest", { a: "max_tentativas", b: 3 }))
        .order("prioridade", { ascending: false })
        .order("agendado_para", { ascending: true })
        .limit(limit);

      if (canal) {
        query = query.eq("canal", canal);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Mark as processing
      if (data && data.length > 0) {
        const ids = data.map(d => d.id);
        await supabase
          .from("fila_cobrancas")
          .update({ status: "processando", updated_at: new Date().toISOString() })
          .in("id", ids);
      }

      console.log(`[Cobrança] Retornando ${data?.length || 0} pendentes`);
      return new Response(JSON.stringify({ success: true, data, count: data?.length || 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ ATUALIZAR-STATUS - Update item status ============
    if (path === "atualizar-status" && req.method === "POST") {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { fila_id, status, erro_mensagem, provider_id, provider_response, destinatario, mensagem_enviada, assunto } = body;

      if (!fila_id || !status) {
        return new Response(JSON.stringify({ error: "fila_id e status são obrigatórios" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Update queue item
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (erro_mensagem) updateData.erro_mensagem = erro_mensagem;
      if (status === "erro") {
        updateData.tentativas = supabase.rpc("increment_tentativas", { row_id: fila_id });
      }

      const { data: filaItem, error: updateError } = await supabase
        .from("fila_cobrancas")
        .update(updateData)
        .eq("id", fila_id)
        .select()
        .single();

      if (updateError) throw updateError;

      // If sent successfully, record in history
      if (status === "enviado" && filaItem) {
        await supabase
          .from("cobrancas_enviadas")
          .insert({
            fila_id,
            cliente_codigo: filaItem.cliente_codigo,
            cliente_nome: filaItem.cliente_nome,
            conta_receber_id: filaItem.conta_receber_id,
            canal: filaItem.canal,
            destinatario: destinatario || filaItem.cliente_email || filaItem.cliente_telefone,
            assunto,
            mensagem: mensagem_enviada || filaItem.mensagem_personalizada || "",
            provider_id,
            provider_response,
          });
      }

      console.log(`[Cobrança] Status atualizado: ${fila_id} -> ${status}`);
      return new Response(JSON.stringify({ success: true, data: filaItem }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ ENVIAR-EMAIL - Send email directly via Resend ============
    if (path === "enviar-email" && req.method === "POST") {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada" }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Fetch sender configuration
      const { data: configData } = await supabase
        .from("configuracoes_cobranca")
        .select("email_remetente, nome_remetente")
        .single();

      const senderEmail = configData?.email_remetente || "cobranca@resend.dev";
      const senderName = configData?.nome_remetente || "Cobrança";
      const fromAddress = `${senderName} <${senderEmail}>`;

      const resend = new Resend(resendApiKey);
      const body = await req.json();
      const { fila_id, to, subject, html, from } = body;

      if (!to || !subject || !html) {
        return new Response(JSON.stringify({ error: "to, subject e html são obrigatórios" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const emailResponse = await resend.emails.send({
        from: from || fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      });

      const emailId = (emailResponse as any).data?.id || (emailResponse as any).id || 'unknown';
      console.log(`[Cobrança] Email enviado para ${to}: ${emailId}`);

      // Update queue if fila_id provided
      if (fila_id) {
        await supabase
          .from("fila_cobrancas")
          .update({ status: "enviado", updated_at: new Date().toISOString() })
          .eq("id", fila_id);

        // Get queue item details
        const { data: filaItem } = await supabase
          .from("fila_cobrancas")
          .select()
          .eq("id", fila_id)
          .single();

        if (filaItem) {
          await supabase
            .from("cobrancas_enviadas")
            .insert({
              fila_id,
              cliente_codigo: filaItem.cliente_codigo,
              cliente_nome: filaItem.cliente_nome,
              conta_receber_id: filaItem.conta_receber_id,
              canal: "email",
              destinatario: to,
              assunto: subject,
              mensagem: html,
              provider_id: emailId,
              provider_response: emailResponse as any,
            });
        }
      }

      return new Response(JSON.stringify({ success: true, id: emailId }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ PROCESSAR-FILA - Process queue items directly ============
    if (path === "processar-fila" && req.method === "POST") {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const resend = resendApiKey ? new Resend(resendApiKey) : null;

      // Fetch sender configuration
      const { data: configData } = await supabase
        .from("configuracoes_cobranca")
        .select("email_remetente, nome_remetente")
        .single();

      const senderEmail = configData?.email_remetente || "cobranca@resend.dev";
      const senderName = configData?.nome_remetente || "Cobrança";
      const fromAddress = `${senderName} <${senderEmail}>`;

      // Get pending email items
      const { data: pendentes, error: fetchError } = await supabase
        .from("fila_cobrancas")
        .select(`
          *,
          template:templates_cobranca(nome, canal, assunto, conteudo),
          conta:contas_receber(valor_aberto, data_vencimento, numero_documento, dias_atraso)
        `)
        .eq("status", "pendente")
        .eq("canal", "email")
        .lte("agendado_para", new Date().toISOString())
        .order("prioridade", { ascending: false })
        .limit(10);

      if (fetchError) throw fetchError;

      const results = { enviados: 0, erros: 0, detalhes: [] as any[] };

      for (const item of pendentes || []) {
        try {
          if (!item.cliente_email) {
            await supabase
              .from("fila_cobrancas")
              .update({ status: "erro", erro_mensagem: "Email do cliente não informado" })
              .eq("id", item.id);
            results.erros++;
            results.detalhes.push({ id: item.id, status: "erro", motivo: "Email não informado" });
            continue;
          }

          // Build email content
          const templateData = {
            cliente_nome: item.cliente_nome || "Cliente",
            valor: item.conta?.valor_aberto ? formatCurrency(item.conta.valor_aberto) : "R$ 0,00",
            vencimento: item.conta?.data_vencimento ? formatDate(item.conta.data_vencimento) : "-",
            documento: item.conta?.numero_documento || "-",
            dias_atraso: item.conta?.dias_atraso || 0,
            link_pagamento: "#",
          };

          let subject = item.template?.assunto || "Cobrança";
          let html = item.mensagem_personalizada || item.template?.conteudo || "";

          subject = processTemplate(subject, templateData);
          html = processTemplate(html, templateData);
          html = html.replace(/\n/g, "<br>");

          if (resend) {
            const emailResponse = await resend.emails.send({
              from: fromAddress,
              to: [item.cliente_email],
              subject,
              html,
            });

            // Update queue and create history
            await supabase
              .from("fila_cobrancas")
              .update({ status: "enviado", updated_at: new Date().toISOString() })
              .eq("id", item.id);

            const resendEmailId = (emailResponse as any).data?.id || (emailResponse as any).id || 'unknown';
            
            await supabase
              .from("cobrancas_enviadas")
              .insert({
                fila_id: item.id,
                cliente_codigo: item.cliente_codigo,
                cliente_nome: item.cliente_nome,
                conta_receber_id: item.conta_receber_id,
                canal: "email",
                destinatario: item.cliente_email,
                assunto: subject,
                mensagem: html,
                provider_id: resendEmailId,
                provider_response: emailResponse as any,
              });

            results.enviados++;
            results.detalhes.push({ id: item.id, status: "enviado", email: item.cliente_email });
          }
        } catch (itemError: any) {
          console.error(`[Cobrança] Erro ao processar item ${item.id}:`, itemError);
          await supabase
            .from("fila_cobrancas")
            .update({ 
              status: "erro", 
              erro_mensagem: itemError.message,
              tentativas: (item.tentativas || 0) + 1
            })
            .eq("id", item.id);
          results.erros++;
          results.detalhes.push({ id: item.id, status: "erro", motivo: itemError.message });
        }
      }

      console.log(`[Cobrança] Processados: ${results.enviados} enviados, ${results.erros} erros`);
      return new Response(JSON.stringify({ success: true, ...results }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ STATS - Get queue statistics ============
    if (path === "stats" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Queue stats
      const { data: filaStats } = await supabase
        .from("fila_cobrancas")
        .select("status, canal")
        .then(({ data }) => {
          const stats = {
            total: data?.length || 0,
            pendente: data?.filter(d => d.status === "pendente").length || 0,
            processando: data?.filter(d => d.status === "processando").length || 0,
            enviado: data?.filter(d => d.status === "enviado").length || 0,
            erro: data?.filter(d => d.status === "erro").length || 0,
            por_canal: {
              email: data?.filter(d => d.canal === "email").length || 0,
              whatsapp: data?.filter(d => d.canal === "whatsapp").length || 0,
              sms: data?.filter(d => d.canal === "sms").length || 0,
            }
          };
          return { data: stats };
        });

      // Sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: enviadosHoje } = await supabase
        .from("cobrancas_enviadas")
        .select("*", { count: "exact", head: true })
        .gte("enviado_em", today.toISOString());

      // Sent this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: enviadosSemana } = await supabase
        .from("cobrancas_enviadas")
        .select("*", { count: "exact", head: true })
        .gte("enviado_em", weekAgo.toISOString());

      return new Response(JSON.stringify({
        success: true,
        fila: filaStats,
        enviados: {
          hoje: enviadosHoje || 0,
          semana: enviadosSemana || 0,
        }
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ TEMPLATES - List templates ============
    if (path === "templates" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const canal = url.searchParams.get("canal");
      let query = supabase
        .from("templates_cobranca")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (canal) {
        query = query.eq("canal", canal);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ REGRAS - List rules ============
    if (path === "regras" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("regras_cobranca")
        .select(`
          *,
          template:templates_cobranca(nome, canal)
        `)
        .order("prioridade");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ IMPORTAR-CLIENTES - Import clients from ERP (synchronous batched processing) ============
    if (path === "importar-clientes" && req.method === "POST") {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const clientes = Array.isArray(body) ? body : body.clientes;

      if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
        return new Response(JSON.stringify({ error: "Array de clientes é obrigatório" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const BATCH_SIZE = 2000;
      const totalBatches = Math.ceil(clientes.length / BATCH_SIZE);
      const startTime = Date.now();

      console.log(`[Clientes] Recebidos ${clientes.length} registros | ${totalBatches} batches de ${BATCH_SIZE} | Processamento SÍNCRONO`);

      let totalInseridos = 0;
      let totalAtualizados = 0;
      let totalErros = 0;
      const batchResults: Array<{ batch: number; size: number; status: string; duration_ms: number; error?: string }> = [];

      for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const batchStart = Date.now();

        try {
          const { data, error } = await supabase.rpc("importar_clientes", {
            p_clientes: batch,
          });

          const batchDuration = Date.now() - batchStart;

          if (error) {
            console.error(`[Clientes] ❌ Batch ${batchNum}/${totalBatches} ERRO (${batchDuration}ms): ${error.message}`);
            totalErros += batch.length;
            batchResults.push({ batch: batchNum, size: batch.length, status: "error", duration_ms: batchDuration, error: error.message });
          } else {
            const inseridos = (data as any)?.inseridos || 0;
            const atualizados = (data as any)?.atualizados || 0;
            totalInseridos += inseridos;
            totalAtualizados += atualizados;
            const rate = batchDuration > 0 ? Math.round((batch.length / batchDuration) * 1000) : 0;
            console.log(`[Clientes] ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} processados em ${batchDuration}ms (${rate}/s) | +${inseridos} novos, +${atualizados} atualizados`);
            batchResults.push({ batch: batchNum, size: batch.length, status: "ok", duration_ms: batchDuration });
          }
        } catch (batchErr) {
          const batchDuration = Date.now() - batchStart;
          console.error(`[Clientes] ❌ Batch ${batchNum}/${totalBatches} EXCEÇÃO (${batchDuration}ms):`, batchErr);
          totalErros += batch.length;
          batchResults.push({ batch: batchNum, size: batch.length, status: "exception", duration_ms: batchDuration, error: String(batchErr) });
        }
      }

      const totalDuration = Date.now() - startTime;
      const totalRate = totalDuration > 0 ? Math.round((clientes.length / totalDuration) * 1000) : 0;

      console.log(`[Clientes] 🏁 Importação completa em ${totalDuration}ms: ${totalInseridos} novos, ${totalAtualizados} atualizados, ${totalErros} erros (${totalRate}/s)`);

      const result = {
        success: totalErros === 0,
        total_recebidos: clientes.length,
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        erros: totalErros,
        batches_processados: totalBatches,
        batch_size: BATCH_SIZE,
        duration_ms: totalDuration,
        rate_per_second: totalRate,
        processing: "synchronous",
        batch_details: batchResults,
      };

      return new Response(JSON.stringify(result), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ CLIENTES - List/search clients ============
    if (path === "clientes" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const search = url.searchParams.get("search");
      const rota = url.searchParams.get("rota");
      const status = url.searchParams.get("status");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("vw_clientes_cobranca")
        .select("*")
        .limit(limit);

      if (search) {
        query = query.or(`cliente_nome.ilike.%${search}%,cnpj.ilike.%${search}%,cliente_codigo.ilike.%${search}%`);
      }
      if (rota) {
        query = query.eq("rota", rota);
      }
      if (status) {
        query = query.eq("status_bloqueio", status);
      }

      const { data, error } = await query.order("cliente_nome");
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data, count: data?.length || 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ============ CLIENTE-DETALHE - Get client details for billing ============
    if (path === "cliente-detalhe" && (req.method === "GET" || req.method === "POST")) {
      const auth = await authenticateRequest(req, supabase);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const codigo = url.searchParams.get("codigo");
      if (!codigo) {
        return new Response(JSON.stringify({ error: "codigo é obrigatório" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Get client data
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("*")
        .eq("codigo", codigo)
        .single();

      if (clienteError && clienteError.code !== "PGRST116") throw clienteError;

      // Get open titles
      const { data: titulos, error: titulosError } = await supabase
        .from("contas_receber")
        .select("*")
        .eq("cliente_codigo", codigo)
        .in("status", ["vencido", "pendente"])
        .gt("valor_aberto", 0)
        .order("data_vencimento");

      if (titulosError) throw titulosError;

      // Get credit profile
      const { data: perfil } = await supabase
        .from("clientes_perfil_credito")
        .select("*")
        .eq("cliente_codigo", codigo)
        .single();

      // Get collection history
      const { data: historico } = await supabase
        .from("cobrancas_enviadas")
        .select("*")
        .eq("cliente_codigo", codigo)
        .order("enviado_em", { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({
        success: true,
        cliente,
        titulos_abertos: titulos || [],
        perfil_credito: perfil,
        historico_cobrancas: historico || [],
        resumo: {
          total_titulos: titulos?.length || 0,
          valor_total: titulos?.reduce((sum, t) => sum + (t.valor_aberto || 0), 0) || 0,
          maior_atraso: titulos?.reduce((max, t) => Math.max(max, t.dias_atraso || 0), 0) || 0,
        }
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Default response
    return new Response(JSON.stringify({ 
      error: "Endpoint não encontrado",
      endpoints: [
        "POST /enfileirar - Adiciona cobrança à fila",
        "GET /pendentes - Retorna itens pendentes para N8N",
        "POST /atualizar-status - Atualiza status de item",
        "POST /enviar-email - Envia email direto via Resend",
        "POST /processar-fila - Processa fila de emails",
        "GET /stats - Estatísticas da fila",
        "GET /templates - Lista templates",
        "GET /regras - Lista regras de escalonamento",
        "POST /importar-clientes - Importa clientes do ERP",
        "GET /clientes - Lista/pesquisa clientes",
        "GET /cliente-detalhe?codigo=X - Detalhes do cliente para cobrança",
      ]
    }), {
      status: 404,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Cobrança] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
}));

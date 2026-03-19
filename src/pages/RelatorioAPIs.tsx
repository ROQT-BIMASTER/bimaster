import { Button } from "@/components/ui/button";
import { Printer, Network, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RelatorioAPIs = () => {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          pre { font-size: 9px !important; line-height: 1.3 !important; }
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; break-before: page; }
          h3 { font-size: 13px !important; }
          p, li, td { font-size: 11px !important; line-height: 1.5 !important; }
          table { font-size: 10px !important; }
          .page-break { break-before: page; }
        }
      `}</style>

      <div className="print-area max-w-5xl mx-auto p-6 space-y-8">
        {/* Header com botões */}
        <div className="no-print flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>

        {/* CAPA */}
        <div className="text-center border-b-4 border-primary pb-8 mb-8">
          <Network className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">
            Relatório Técnico de APIs e Integrações
          </h1>
          <p className="text-xl text-muted-foreground mt-2">Sistema BiMaster / Huggs CRM</p>
          <div className="mt-4 inline-block bg-primary/10 text-primary font-bold text-2xl px-6 py-3 rounded-lg">
            100+ Edge Functions · 6 APIs Externas
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Documento Confidencial — {new Date().toLocaleDateString('pt-BR')} — Versão 1.0
          </p>
        </div>

        {/* 1. RESUMO EXECUTIVO */}
        <section>
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            1. Resumo Executivo
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            O sistema BiMaster/Huggs possui uma arquitetura de <strong>microserviços serverless</strong> com mais de 
            <strong> 100 Edge Functions</strong> organizadas em 8 domínios funcionais. A infraestrutura suporta 
            integração bidirecional com ERPs (SAP/TOTVS), Open Finance (Pluggy/BACEN), WhatsApp Business, 
            Google Maps, IA generativa (Gemini/GPT) e plataformas de marketing digital. Todas as APIs seguem 
            padrões REST com autenticação JWT ou API Key conforme o caso de uso.
          </p>
          <table className="w-full mt-4 border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-left text-foreground">Domínio</th>
                <th className="border p-2 text-center text-foreground">Qtd. Functions</th>
                <th className="border p-2 text-center text-foreground">Autenticação</th>
                <th className="border p-2 text-center text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Financeiro / ERP", "15+", "API Key + JWT", "✅ Produção"],
                ["IA & Classificação", "12+", "JWT", "✅ Produção"],
                ["CRM & Comunicação", "10+", "JWT + Webhook", "✅ Produção"],
                ["Trade Marketing", "8+", "JWT", "✅ Produção"],
                ["Logística / China", "6+", "JWT", "✅ Produção"],
                ["Analytics & Export", "10+", "JWT", "✅ Produção"],
                ["Fábrica & Produção", "8+", "JWT", "✅ Produção"],
                ["Infraestrutura", "15+", "API Key / Interno", "✅ Produção"],
              ].map(([dom, qtd, auth, status]) => (
                <tr key={dom} className="border-b">
                  <td className="border p-2 text-foreground">{dom}</td>
                  <td className="border p-2 text-center font-mono text-foreground">{qtd}</td>
                  <td className="border p-2 text-center text-muted-foreground">{auth}</td>
                  <td className="border p-2 text-center">{status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 2. ARQUITETURA GERAL */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            2. Arquitetura Geral de APIs
          </h2>
          <pre className="mt-4 bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React / Vite)                                │
│                                                                                     │
│   supabase.functions.invoke()  │  supabase.from().select()  │  fetch() direto       │
└───────────────┬────────────────┴──────────┬─────────────────┴──────────┬────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌───────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
│   EDGE FUNCTIONS (Deno)   │  │   POSTGREST (REST)   │  │  WEBHOOKS EXTERNOS       │
│                           │  │                      │  │                          │
│  ┌──────────────────────┐ │  │  Auto-generated CRUD │  │  Pluggy → pluggy-webhook │
│  │ JWT Functions (90+)  │ │  │  from public schema  │  │  WhatsApp → wa-webhook   │
│  │ - contas-pagar-api   │ │  │                      │  │  ERP → erp-webhook-inb.  │
│  │ - trade-marketing-api│ │  │  RLS policies filter │  │  Cobrança → cobr-webhook │
│  │ - ai-analytics       │ │  │  data per user/role  │  │                          │
│  └──────────────────────┘ │  │                      │  │  Auth: API Key / HMAC    │
│  ┌──────────────────────┐ │  └──────────────────────┘  │  verify_jwt = false      │
│  │ API Key Funcs (10+)  │ │                            └──────────────────────────┘
│  │ - contas-pagar-export│ │              │
│  │ - erp-webhook-inbound│ │              ▼
│  │ - estoque-api        │ │  ┌──────────────────────┐
│  └──────────────────────┘ │  │   BANCO DE DADOS     │
│  ┌──────────────────────┐ │  │   (PostgreSQL 15)    │
│  │ Workers Internos     │ │  │                      │
│  │ - photo-analysis     │ │  │  367+ tabelas c/ RLS │
│  │ - social-media-cron  │ │  │  Triggers & Functions│
│  └──────────────────────┘ │  │  Realtime channels   │
└───────────────────────────┘  └──────────────────────┘`}</pre>
        </section>

        {/* 3. FLUXO DE AUTENTICAÇÃO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            3. Padrões de Autenticação de API
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <div>
              <h3 className="font-bold">3.1 JWT (Bearer Token) — Funções do Frontend</h3>
              <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌──────────┐      ┌─────────────────┐      ┌──────────────────────┐
  │ Frontend │─────▶│ Authorization:  │─────▶│ Edge Function        │
  │ (React)  │      │ Bearer <JWT>    │      │                      │
  └──────────┘      └─────────────────┘      │ 1. Extrai JWT        │
                                              │ 2. supabase.getUser()│
                                              │ 3. Valida role       │
                                              │ 4. Executa lógica    │
                                              └──────────────────────┘`}</pre>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
                <li>Token JWT assinado por HMAC-SHA256</li>
                <li>Renovação automática antes da expiração</li>
                <li>Todas as funções validam <code>auth.getUser()</code> internamente</li>
                <li>Funções críticas verificam role no banco via <code>has_role()</code></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold">3.2 API Key — Integrações Externas (ERP / Polling)</h3>
              <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌──────────┐      ┌─────────────────┐      ┌──────────────────────┐
  │   ERP    │─────▶│ x-api-key:      │─────▶│ Edge Function        │
  │ (TOTVS)  │      │ <chave>         │      │                      │
  └──────────┘      └─────────────────┘      │ 1. Lê x-api-key     │
                                              │ 2. Busca erp_config  │
                                              │ 3. Valida empresa_id │
                                              │ 4. Multi-tenant OK   │
                                              └──────────────────────┘`}</pre>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
                <li>Chave armazenada em <code>erp_config.api_key</code> por empresa</li>
                <li>Suporte multi-filial com isolamento por <code>empresa_id</code></li>
                <li><code>verify_jwt = false</code> no config.toml</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold">3.3 HMAC Webhook — Pluggy (Open Finance)</h3>
              <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌──────────┐      ┌─────────────────┐      ┌──────────────────────┐
  │  Pluggy  │─────▶│ x-pluggy-       │─────▶│ pluggy-webhook       │
  │  (BACEN) │      │ signature: HMAC │      │                      │
  └──────────┘      └─────────────────┘      │ 1. Recebe body raw   │
                                              │ 2. Calcula HMAC-256  │
                                              │ 3. Compara assinatura│
                                              │ 4. Processa evento   │
                                              └──────────────────────┘`}</pre>
            </div>
          </div>
        </section>

        {/* 4. DOMÍNIO FINANCEIRO / ERP */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            4. APIs do Domínio Financeiro / ERP
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">4.1 Catálogo de Edge Functions</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Método</th>
                  <th className="border p-2 text-left">Auth</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">contas-pagar-api</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">CRUD completo de contas a pagar</td></tr>
                <tr><td className="border p-2 font-mono text-xs">contas-pagar-export-api</td><td className="border p-2">GET/POST</td><td className="border p-2">API Key</td><td className="border p-2">Exportação para ERP (provisão + baixa + cancelamento)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-export-payment</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Envia pagamento individual ao ERP via n8n</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-webhook-inbound</td><td className="border p-2">POST</td><td className="border p-2">API Key</td><td className="border p-2">Recebe notificações do ERP (provisão, baixa, estorno)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-fornecedores-query</td><td className="border p-2">GET</td><td className="border p-2">API Key</td><td className="border p-2">Consulta fornecedores para sincronização</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-portadores-api</td><td className="border p-2">GET/POST</td><td className="border p-2">API Key</td><td className="border p-2">Sincronização de portadores/bancos</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-plano-contas-api</td><td className="border p-2">GET/POST</td><td className="border p-2">API Key</td><td className="border p-2">DE-PARA de plano de contas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">contas-receber-api</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">CRUD de contas a receber</td></tr>
                <tr><td className="border p-2 font-mono text-xs">conciliacao-bancaria</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Conciliação automática de extrato bancário</td></tr>
                <tr><td className="border p-2 font-mono text-xs">pluggy-webhook</td><td className="border p-2">POST</td><td className="border p-2">HMAC</td><td className="border p-2">Webhook Open Finance (sync de transações)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">pluggy-proxy</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Proxy seguro para API Pluggy</td></tr>
                <tr><td className="border p-2 font-mono text-xs">cobranca-automation-api</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Automação de cobrança de inadimplentes</td></tr>
                <tr><td className="border p-2 font-mono text-xs">cobranca-whatsapp-webhook</td><td className="border p-2">POST</td><td className="border p-2">Token</td><td className="border p-2">Webhook de resposta WhatsApp de cobrança</td></tr>
                <tr><td className="border p-2 font-mono text-xs">fiscal-iva-api</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Cálculos fiscais (IVA/impostos)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">process-nfe-xml</td><td className="border p-2">POST</td><td className="border p-2">JWT</td><td className="border p-2">Processamento de XML de NF-e</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">4.2 Fluxo Bidirecional CRM ↔ ERP</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                        CICLO DE VIDA DO TÍTULO                          │
  └──────────────────────────────────────────────────────────────────────────┘

  CRM (BiMaster)                                             ERP (TOTVS/SAP)
  ─────────────────                                          ─────────────────
  
  Lançamento ──▶ Aprovação ──▶ Aceito ──────────────────────▶ PROVISÃO
                                │                              (cadastra título)
                                │                                    │
                                │            ┌───── Confirma ────────┘
                                │            ▼         (POST /confirm
                                │     erp_export_queue    export_type:
                                │     status: "exportado"  "registration")
                                │
                                ▼
                            Pagamento ──────────────────────▶ BAIXA
                            (no CRM)                          (baixa título)
                                │                                    │
                                │            ┌───── Confirma ────────┘
                                │            ▼         (POST /confirm
                                │     erp_export_queue    export_type:
                                │     status: "exportado"  "payment")
                                │
                                ▼
                          Cancelamento ─────────────────────▶ ESTORNO
                          (status='cancelado')                (estorna no ERP)
                                                                     │
                                             ┌───── Confirma ────────┘
                                             ▼         (POST /confirm
                                      erp_export_queue    export_type:
                                      status: "exportado"  "cancellation")

  ─────────────────────────────────────────────────────────────────────────
  RETORNO (ERP → CRM):
  
  ERP envia POST para /erp-webhook-inbound com:
    • provisao_registrada  → status fila: "confirmado_erp"
    • baixa_confirmada     → status fila: "baixado_erp" + conta → "pago"
    • estorno_processado   → status fila: "estornado_erp"
    • erro_processamento   → status fila: "erro_erp" + mensagem`}</pre>

            <h3 className="font-bold mt-4">4.3 Endpoints da API de Exportação (contas-pagar-export-api)</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Endpoint</th>
                  <th className="border p-2 text-left">Método</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">/pending</td><td className="border p-2">GET</td><td className="border p-2">Itens aceitos pendentes de exportação (provisão)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">/paid</td><td className="border p-2">GET</td><td className="border p-2">Itens pagos pendentes de exportação (baixa)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">/cancelled</td><td className="border p-2">GET</td><td className="border p-2">Títulos cancelados para estorno no ERP</td></tr>
                <tr><td className="border p-2 font-mono text-xs">/confirm</td><td className="border p-2">POST</td><td className="border p-2">Marca itens como exportados (registration/payment/cancellation)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">/status</td><td className="border p-2">GET</td><td className="border p-2">Dashboard de pendências de exportação</td></tr>
                <tr><td className="border p-2 font-mono text-xs">/?status=accepted,paid</td><td className="border p-2">GET</td><td className="border p-2">Filtro por status múltiplos</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">4.4 Webhook Inbound do ERP (erp-webhook-inbound)</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono text-foreground">{`
  ERP envia POST com:
  ┌─────────────────────────────────────────────────┐
  │ Headers:                                         │
  │   x-api-key: <chave da erp_config>              │
  │   x-idempotency-key: <UUID único> (opcional)    │
  │                                                  │
  │ Body:                                            │
  │   {                                              │
  │     "evento": "baixa_confirmada",                │
  │     "empresa_id": 1,                             │
  │     "referencia_erp": "NF-12345",                │
  │     "status_erp": "BAIXADO",                     │
  │     "data_processamento": "2026-03-19T10:00:00Z",│
  │     "valor_processado": 1500.00                  │
  │   }                                              │
  └─────────────────────────────────────────────────┘
  
  Processamento:
  1. Valida API Key contra erp_config (multi-tenant)
  2. Verifica idempotência (7 dias) via erp_sync_log
  3. Mapeia evento → status interno:
     • provisao_registrada → confirmado_erp
     • baixa_confirmada   → baixado_erp
     • estorno_processado → estornado_erp
     • erro_processamento → erro_erp
  4. Atualiza erp_export_queue
  5. Se baixa_confirmada: atualiza contas_pagar (pago)
     → Ignora se já pago (Pluggy processou primeiro)
  6. Registra em erp_sync_log`}</pre>
          </div>
        </section>

        {/* 5. OPEN FINANCE / PLUGGY */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            5. Open Finance — Integração Pluggy (BACEN)
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">5.1 Fluxo de Conciliação Automática</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono text-foreground">{`
  ┌──────────────────┐     Webhook POST      ┌──────────────────────┐
  │   PLUGGY          │────────────────────▶  │  pluggy-webhook      │
  │   (Open Finance)  │  event: item/updated  │                      │
  │                    │  x-pluggy-signature   │  1. Valida HMAC      │
  └──────────────────┘                        │  2. Busca transações │
                                               │  3. Para cada tx:    │
                                               └──────────┬───────────┘
                                                          │
                                          ┌───────────────┼───────────────┐
                                          ▼               ▼               ▼
                                    ┌──────────┐   ┌──────────┐   ┌──────────┐
                                    │ Match    │   │ Match    │   │ Sem      │
                                    │ ALTA     │   │ MÉDIA    │   │ Match    │
                                    │          │   │          │   │          │
                                    │ Doc +    │   │ Data ±3d │   │ Registra │
                                    │ Valor    │   │ + Valor  │   │ para     │
                                    │ exato    │   │ exato    │   │ revisão  │
                                    └────┬─────┘   └────┬─────┘   └──────────┘
                                         │              │
                                         ▼              ▼
                                   ┌───────────┐  ┌───────────┐
                                   │ Baixa     │  │ Sugestão  │
                                   │ Automática│  │ Manual    │
                                   │           │  │           │
                                   │ status:   │  │ confiança │
                                   │  "pago"   │  │  "média"  │
                                   │ baixa_    │  │           │
                                   │  origem:  │  │           │
                                   │  "pluggy" │  │           │
                                   └───────────┘  └───────────┘`}</pre>

            <h3 className="font-bold mt-4">5.2 Módulos Pluggy Disponíveis</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Módulo</th>
                  <th className="border p-2 text-left">Dados Obtidos</th>
                  <th className="border p-2 text-left">Tabela de Destino</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2">Saldos Bancários</td><td className="border p-2">Saldo corrente, poupança</td><td className="border p-2 font-mono text-xs">bank_connections</td></tr>
                <tr><td className="border p-2">Transações</td><td className="border p-2">Extrato bancário completo</td><td className="border p-2 font-mono text-xs">bank_transactions</td></tr>
                <tr><td className="border p-2">Investimentos</td><td className="border p-2">Carteira, rendimentos</td><td className="border p-2 font-mono text-xs">pluggy_investments</td></tr>
                <tr><td className="border p-2">Cartões de Crédito</td><td className="border p-2">Faturas, limites</td><td className="border p-2 font-mono text-xs">bank_connections (credit)</td></tr>
                <tr><td className="border p-2">Empréstimos</td><td className="border p-2">Saldos, parcelas, juros</td><td className="border p-2 font-mono text-xs">pluggy_loans</td></tr>
                <tr><td className="border p-2">Identidade</td><td className="border p-2">Validação do titular</td><td className="border p-2 font-mono text-xs">pluggy_identities</td></tr>
              </tbody>
            </table>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary">
              <strong>Concorrência de Baixa:</strong> Quando Pluggy e ERP tentam baixar o mesmo título, 
              o sistema usa o princípio "first-write-wins": a primeira baixa (via <code>pluggy</code> ou <code>erp_webhook</code>) 
              é aceita, e a segunda é ignorada silenciosamente com flag <code>conta_ja_paga: true</code>.
            </div>
          </div>
        </section>

        {/* 6. IA & CLASSIFICAÇÃO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            6. APIs de Inteligência Artificial
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Modelo IA</th>
                  <th className="border p-2 text-left">Caso de Uso</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">classificar-contas-pagar-ia</td><td className="border p-2">Gemini</td><td className="border p-2">Classificação automática de despesas no DRE</td></tr>
                <tr><td className="border p-2 font-mono text-xs">classificar-categoria-dre</td><td className="border p-2">Gemini</td><td className="border p-2">Categorização por plano de contas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">classificar-contas-batch</td><td className="border p-2">Gemini</td><td className="border p-2">Classificação em lote (batch)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">classificar-conta-departamento</td><td className="border p-2">Gemini</td><td className="border p-2">Sugestão de departamento responsável</td></tr>
                <tr><td className="border p-2 font-mono text-xs">ai-analytics</td><td className="border p-2">GPT / Gemini</td><td className="border p-2">Análise avançada de dados com linguagem natural</td></tr>
                <tr><td className="border p-2 font-mono text-xs">ai-insights</td><td className="border p-2">GPT</td><td className="border p-2">Insights preditivos de vendas e oportunidades</td></tr>
                <tr><td className="border p-2 font-mono text-xs">contas-pagar-ai-chat</td><td className="border p-2">Gemini</td><td className="border p-2">Chat conversacional sobre contas a pagar</td></tr>
                <tr><td className="border p-2 font-mono text-xs">expense-ai-assistant</td><td className="border p-2">Gemini</td><td className="border p-2">Assistente de aprovação de despesas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">analyze-shelf-photos</td><td className="border p-2">Google Vision</td><td className="border p-2">Análise de fotos de gôndola (share of shelf)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">analyze-competitor-photo</td><td className="border p-2">Google Vision</td><td className="border p-2">Identificação de produtos concorrentes</td></tr>
                <tr><td className="border p-2 font-mono text-xs">lead-insight</td><td className="border p-2">Gemini</td><td className="border p-2">Enriquecimento e scoring de leads</td></tr>
                <tr><td className="border p-2 font-mono text-xs">huggs-agent-chat</td><td className="border p-2">GPT / Gemini</td><td className="border p-2">Agente conversacional corporativo</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">6.1 Fluxo de Classificação Automática (DRE)</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono text-foreground">{`
  Conta a Pagar      ┌────────────────────┐      ┌────────────────────┐
  (nova ou sem       │ Busca regras       │      │ Chama IA           │
   categoria)  ─────▶│ em account_        │─────▶│ (Gemini)           │
                     │ classification_    │  Sem │                    │
                     │ rules              │ regra│ Prompt:            │
                     └────────┬───────────┘      │ - Histórico desc.  │
                              │ Achou             │ - Fornecedor       │
                              │ regra             │ - Valor            │
                              ▼                   │ - Exemplos treino  │
                     ┌────────────────────┐      └────────┬───────────┘
                     │ Aplica categoria   │               │
                     │ + departamento     │               ▼
                     │ automaticamente    │      ┌────────────────────┐
                     └────────────────────┘      │ Retorna:           │
                                                  │ - codigo_dre       │
                                                  │ - departamento     │
                                                  │ - confiança (0-1)  │
                                                  │                    │
                                                  │ Salva regra para   │
                                                  │ reuso futuro       │
                                                  └────────────────────┘`}</pre>
          </div>
        </section>

        {/* 7. CRM & COMUNICAÇÃO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            7. APIs de CRM e Comunicação
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Integração</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">whatsapp-business-api</td><td className="border p-2">WhatsApp Business</td><td className="border p-2">Envio de mensagens e templates</td></tr>
                <tr><td className="border p-2 font-mono text-xs">whatsapp-webhook</td><td className="border p-2">WhatsApp Business</td><td className="border p-2">Recebe mensagens e status de entrega</td></tr>
                <tr><td className="border p-2 font-mono text-xs">analyze-whatsapp-sentiment</td><td className="border p-2">IA + WhatsApp</td><td className="border p-2">Análise de sentimento em conversas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">social-media-metrics</td><td className="border p-2">Meta/TikTok/LinkedIn</td><td className="border p-2">Coleta métricas de redes sociais</td></tr>
                <tr><td className="border p-2 font-mono text-xs">sync-all-accounts</td><td className="border p-2">Multi-plataforma</td><td className="border p-2">Sincronização de todas as contas sociais</td></tr>
                <tr><td className="border p-2 font-mono text-xs">social-media-cron</td><td className="border p-2">Interno (Worker)</td><td className="border p-2">Agendamento de posts e coleta periódica</td></tr>
                <tr><td className="border p-2 font-mono text-xs">marketing-insights</td><td className="border p-2">IA</td><td className="border p-2">Insights de performance de marketing</td></tr>
                <tr><td className="border p-2 font-mono text-xs">send-notifications</td><td className="border p-2">Push/Email</td><td className="border p-2">Envio de notificações multicanal</td></tr>
                <tr><td className="border p-2 font-mono text-xs">send-department-expense-notification</td><td className="border p-2">Interno</td><td className="border p-2">Alertas de despesas departamentais</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">7.1 Fluxo WhatsApp Business</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono text-foreground">{`
  ┌──────────────┐     API Meta      ┌────────────────┐     Webhook      ┌──────────────┐
  │  Frontend    │──────────────────▶│  whatsapp-     │◀────────────────│  WhatsApp    │
  │  (CRM)       │  Envia template   │  business-api  │  Status/Resposta│  Cloud API   │
  └──────────────┘                   └────────────────┘                 └──────────────┘
                                            │                                  │
                                            ▼                                  ▼
                                     ┌────────────┐                    ┌──────────────┐
                                     │ Registra   │                    │ whatsapp-    │
                                     │ envio em   │                    │ webhook      │
                                     │ atividades │                    │              │
                                     └────────────┘                    │ • Atualiza   │
                                                                       │   status     │
                                                                       │ • Salva      │
                                                                       │   resposta   │
                                                                       │ • Sentiment  │
                                                                       │   analysis   │
                                                                       └──────────────┘`}</pre>
          </div>
        </section>

        {/* 8. TRADE MARKETING & ANALYTICS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            8. APIs de Trade Marketing, Fábrica e Analytics
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">8.1 Trade Marketing</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">trade-marketing-api</td><td className="border p-2">CRUD de campanhas, orçamentos e aprovações</td></tr>
                <tr><td className="border p-2 font-mono text-xs">trigger-photo-queue</td><td className="border p-2">Enfileira fotos para análise de gôndola</td></tr>
                <tr><td className="border p-2 font-mono text-xs">process-photo-analysis-queue</td><td className="border p-2">Worker: processa fila de análise de fotos</td></tr>
                <tr><td className="border p-2 font-mono text-xs">price-table-approval</td><td className="border p-2">Fluxo de aprovação de tabelas de preço</td></tr>
                <tr><td className="border p-2 font-mono text-xs">generate-product-creative</td><td className="border p-2">Geração de criativos de produtos via IA</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">8.2 Fábrica & Produção</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">produtos-api</td><td className="border p-2">CRUD de produtos acabados e matérias-primas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">estoque-api</td><td className="border p-2">Gestão de estoque (saldos, movimentações)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">estoque-n8n-sync</td><td className="border p-2">Sincronização de estoque via n8n</td></tr>
                <tr><td className="border p-2 font-mono text-xs">extrair-materia-prima-ia</td><td className="border p-2">Extração de insumos de documentos via IA</td></tr>
                <tr><td className="border p-2 font-mono text-xs">extrair-produto-ia</td><td className="border p-2">Extração de dados de produto de imagens</td></tr>
                <tr><td className="border p-2 font-mono text-xs">parse-china-excel</td><td className="border p-2">Parser de planilhas de importação China</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">8.3 Analytics & Exportação</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">datawarehouse-api</td><td className="border p-2">Exportação e queries customizadas no DW</td></tr>
                <tr><td className="border p-2 font-mono text-xs">export-all-data</td><td className="border p-2">Exportação massiva de dados (LGPD)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">export-prospects</td><td className="border p-2">Exportação de prospects (CSV/JSON)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">export-conversion-rates</td><td className="border p-2">Taxas de conversão do funil</td></tr>
                <tr><td className="border p-2 font-mono text-xs">export-datawarehouse</td><td className="border p-2">Export completo do datawarehouse</td></tr>
                <tr><td className="border p-2 font-mono text-xs">export-pdf</td><td className="border p-2">Geração de PDFs (relatórios, fichas)</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 9. GEOLOCALIZAÇÃO & INFRAESTRUTURA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            9. APIs de Geolocalização e Infraestrutura
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Serviço Externo</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">geocode-address</td><td className="border p-2">Google Maps</td><td className="border p-2">Geocodificação de endereço individual</td></tr>
                <tr><td className="border p-2 font-mono text-xs">geocode-batch</td><td className="border p-2">Google Maps</td><td className="border p-2">Geocodificação em lote (admin only)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">google-places-search</td><td className="border p-2">Google Places</td><td className="border p-2">Busca de estabelecimentos próximos</td></tr>
                <tr><td className="border p-2 font-mono text-xs">get-google-maps-key</td><td className="border p-2">Interno</td><td className="border p-2">Fornece API Key do Maps ao frontend</td></tr>
                <tr><td className="border p-2 font-mono text-xs">get-mapbox-token</td><td className="border p-2">Interno</td><td className="border p-2">Fornece token Mapbox ao frontend</td></tr>
                <tr><td className="border p-2 font-mono text-xs">ibge-sync</td><td className="border p-2">IBGE</td><td className="border p-2">Sincronização de dados municipais</td></tr>
                <tr><td className="border p-2 font-mono text-xs">opencnpj-consulta</td><td className="border p-2">OpenCNPJ</td><td className="border p-2">Consulta de CNPJ para validação</td></tr>
                <tr><td className="border p-2 font-mono text-xs">cnpjbiz-consulta</td><td className="border p-2">CNPJ.biz</td><td className="border p-2">Enriquecimento de dados empresariais</td></tr>
                <tr><td className="border p-2 font-mono text-xs">ddos-shield</td><td className="border p-2">Interno</td><td className="border p-2">Rate limiting centralizado (120 req/min)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">api-health-check</td><td className="border p-2">Interno</td><td className="border p-2">Health check de todas as APIs</td></tr>
                <tr><td className="border p-2 font-mono text-xs">admin-reset-password</td><td className="border p-2">Interno</td><td className="border p-2">Reset de senha administrativo</td></tr>
                <tr><td className="border p-2 font-mono text-xs">auth-email-hook</td><td className="border p-2">Interno</td><td className="border p-2">Hook de e-mail de autenticação</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 10. MÍDIA & VOZ */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            10. APIs de Mídia, Voz e Vídeo
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Serviço</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">elevenlabs-tts</td><td className="border p-2">ElevenLabs</td><td className="border p-2">Text-to-Speech de alta qualidade</td></tr>
                <tr><td className="border p-2 font-mono text-xs">elevenlabs-sfx</td><td className="border p-2">ElevenLabs</td><td className="border p-2">Geração de efeitos sonoros</td></tr>
                <tr><td className="border p-2 font-mono text-xs">elevenlabs-music</td><td className="border p-2">ElevenLabs</td><td className="border p-2">Geração de música</td></tr>
                <tr><td className="border p-2 font-mono text-xs">sofia-voice-token</td><td className="border p-2">ElevenLabs</td><td className="border p-2">Token para agente de voz Sofia</td></tr>
                <tr><td className="border p-2 font-mono text-xs">realtime-call-session</td><td className="border p-2">ElevenLabs</td><td className="border p-2">Sessão de chamada em tempo real</td></tr>
                <tr><td className="border p-2 font-mono text-xs">process-call-result</td><td className="border p-2">Interno</td><td className="border p-2">Processa resultado de chamada IA</td></tr>
                <tr><td className="border p-2 font-mono text-xs">meeting-transcribe</td><td className="border p-2">Whisper/Gemini</td><td className="border p-2">Transcrição de reuniões</td></tr>
                <tr><td className="border p-2 font-mono text-xs">meeting-analyze</td><td className="border p-2">GPT/Gemini</td><td className="border p-2">Análise de conteúdo de reunião</td></tr>
                <tr><td className="border p-2 font-mono text-xs">meeting-search</td><td className="border p-2">Interno</td><td className="border p-2">Busca semântica em reuniões</td></tr>
                <tr><td className="border p-2 font-mono text-xs">generate-video</td><td className="border p-2">Pollo AI</td><td className="border p-2">Geração de vídeo a partir de texto</td></tr>
                <tr><td className="border p-2 font-mono text-xs">nano-banana-video</td><td className="border p-2">Pollo AI</td><td className="border p-2">Vídeos de produto customizados</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 11. SEGURANÇA DAS APIs */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            11. Governança e Segurança das APIs
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">11.1 Matriz de Segurança</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Controle</th>
                  <th className="border p-2 text-left">Implementação</th>
                  <th className="border p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2">JWT Obrigatório</td><td className="border p-2">90+ funções validam <code>auth.getUser()</code></td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">API Key Multi-Tenant</td><td className="border p-2">Validação por empresa via <code>erp_config</code></td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">HMAC Webhooks</td><td className="border p-2">Pluggy usa SHA-256; WhatsApp usa token de verificação</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">CORS</td><td className="border p-2">Headers padronizados em todas as funções</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Rate Limiting</td><td className="border p-2">ddos-shield: 120 req/min auth, 60 req/min anon</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Idempotência</td><td className="border p-2">erp-webhook-inbound com janela de 7 dias</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Allowlist de Tabelas</td><td className="border p-2">Datawarehouse API aceita só tabelas aprovadas</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Auditoria de API</td><td className="border p-2"><code>api_security_log</code> com endpoint, método, tempo, IP</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Secrets Management</td><td className="border p-2">Chaves em <code>api_keys_management</code> com rotação trimestral</td><td className="border p-2 text-center">✅</td></tr>
                <tr><td className="border p-2">Monitoramento</td><td className="border p-2">Dashboard de saúde via <code>api-health-check</code></td><td className="border p-2 text-center">✅</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">11.2 Funções sem JWT (Exceções Documentadas)</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Function</th>
                  <th className="border p-2 text-left">Auth Alternativa</th>
                  <th className="border p-2 text-left">Justificativa</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">contas-pagar-export-api</td><td className="border p-2">API Key (erp_config)</td><td className="border p-2">ERP faz polling sem sessão humana</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-webhook-inbound</td><td className="border p-2">API Key (erp_config)</td><td className="border p-2">Notificações server-to-server</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-fornecedores-query</td><td className="border p-2">API Key (erp_config)</td><td className="border p-2">Sync de cadastros ERP</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-portadores-api</td><td className="border p-2">API Key (erp_config)</td><td className="border p-2">Sync de portadores ERP</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp-plano-contas-api</td><td className="border p-2">API Key (erp_config)</td><td className="border p-2">DE-PARA de contas ERP</td></tr>
                <tr><td className="border p-2 font-mono text-xs">pluggy-webhook</td><td className="border p-2">HMAC-SHA256</td><td className="border p-2">Webhook de instituição financeira</td></tr>
                <tr><td className="border p-2 font-mono text-xs">whatsapp-webhook</td><td className="border p-2">Token de verificação</td><td className="border p-2">Webhook da Meta/WhatsApp</td></tr>
                <tr><td className="border p-2 font-mono text-xs">cobranca-whatsapp-webhook</td><td className="border p-2">Token</td><td className="border p-2">Respostas automáticas de cobrança</td></tr>
                <tr><td className="border p-2 font-mono text-xs">social-media-cron</td><td className="border p-2">Scheduler interno</td><td className="border p-2">Cron job de coleta periódica</td></tr>
                <tr><td className="border p-2 font-mono text-xs">process-photo-analysis-queue</td><td className="border p-2">Worker interno</td><td className="border p-2">Processamento em background</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 12. TABELAS DE SUPORTE */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            12. Infraestrutura de Dados das APIs
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">12.1 Tabelas de Auditoria e Controle</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Tabela</th>
                  <th className="border p-2 text-left">Finalidade</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">erp_config</td><td className="border p-2">Configuração multi-tenant (API Key, URL, filial, ativo)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp_export_queue</td><td className="border p-2">Fila de exportação para ERP (status, tipo, timestamps)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp_sync_log</td><td className="border p-2">Log bidirecional de sincronização (payloads, idempotência)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">api_security_log</td><td className="border p-2">Auditoria de chamadas a Edge Functions</td></tr>
                <tr><td className="border p-2 font-mono text-xs">api_access_log</td><td className="border p-2">Log de acesso a APIs públicas</td></tr>
                <tr><td className="border p-2 font-mono text-xs">api_keys_management</td><td className="border p-2">Gestão de chaves (rotação, mascaramento, status)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">bank_connections</td><td className="border p-2">Conexões bancárias via Pluggy (saldos, sync)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">conciliacoes_bancarias</td><td className="border p-2">Resultados de conciliação (match, confiança)</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">12.2 Campos de Rastreabilidade em contas_pagar</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Campo</th>
                  <th className="border p-2 text-left">Tipo</th>
                  <th className="border p-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono text-xs">pluggy_transaction_id</td><td className="border p-2">TEXT</td><td className="border p-2">ID da transação na Pluggy (Open Finance)</td></tr>
                <tr><td className="border p-2 font-mono text-xs">baixa_origem</td><td className="border p-2">TEXT</td><td className="border p-2">"pluggy" | "erp_webhook" | "manual"</td></tr>
                <tr><td className="border p-2 font-mono text-xs">data_baixa</td><td className="border p-2">TIMESTAMPTZ</td><td className="border p-2">Quando a baixa foi processada</td></tr>
                <tr><td className="border p-2 font-mono text-xs">erp_titulo_id</td><td className="border p-2">TEXT</td><td className="border p-2">Referência do título no ERP</td></tr>
                <tr><td className="border p-2 font-mono text-xs">titulo_numero</td><td className="border p-2">TEXT</td><td className="border p-2">Número do título para match</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 13. FLUXO COMPLETO BILATERAL */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            13. Fluxograma Completo — Integração Bilateral
          </h2>
          <pre className="mt-4 bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     VISÃO GERAL — INTEGRAÇÕES EXTERNAS                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
     │  ERP    │         │ Pluggy  │         │WhatsApp │         │ Google  │
     │TOTVS/SAP│         │(BACEN)  │         │Business │         │Maps/AI  │
     └────┬────┘         └────┬────┘         └────┬────┘         └────┬────┘
          │                   │                   │                   │
          │ API Key           │ HMAC              │ Token             │ JWT
          │                   │                   │                   │
          ▼                   ▼                   ▼                   ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                          EDGE FUNCTIONS (Deno Runtime)                    │
  │                                                                          │
  │  erp-webhook-inbound    pluggy-webhook       whatsapp-webhook   geocode  │
  │  contas-pagar-export    pluggy-proxy         wa-business-api    maps-key │
  │  erp-fornecedores       conciliacao          sentiment          places   │
  │  erp-portadores         ───────────          ───────────        ibge     │
  │  erp-plano-contas                                                        │
  └────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                          BANCO DE DADOS (PostgreSQL)                      │
  │                                                                          │
  │  contas_pagar          bank_connections     social_media_*      stores   │
  │  erp_export_queue      bank_transactions    whatsapp_messages   visits   │
  │  erp_sync_log          conciliacoes         atividades          photos   │
  │  erp_config            pluggy_investments   prospects                    │
  │                                                                          │
  │  ┌─────────────────────────────────────────────────────────┐             │
  │  │ TRIGGERS: calcular_status_conta_pagar()                 │             │
  │  │           → preserva 'cancelado', calcula pago/parcial  │             │
  │  │           → first-write-wins para baixa concorrente     │             │
  │  └─────────────────────────────────────────────────────────┘             │
  └───────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                          FRONTEND (React / Vite)                          │
  │                                                                          │
  │  Dashboard Financeiro   Painel Saldos       CRM Pipeline      Trade     │
  │  DRE Analítico          Conciliação         Kanban             Photos   │
  │  Contas a Pagar         Investimentos       WhatsApp Monitor   Maps     │
  │  Fluxo de Caixa         Empréstimos         Agente Huggs       Reports  │
  └───────────────────────────────────────────────────────────────────────────┘`}</pre>
        </section>

        {/* 14. CONCLUSÃO */}
        <section className="page-break border-t-4 border-primary pt-6 mt-8">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            14. Conclusão
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            O ecossistema de APIs do BiMaster/Huggs implementa uma arquitetura de <strong>microserviços serverless</strong> 
            com mais de <strong>100 Edge Functions</strong> organizadas em 8 domínios funcionais. A integração bidirecional 
            com ERPs segue o padrão profissional de <strong>provisão contábil + baixa financeira</strong>, com suporte 
            a cancelamentos e concorrência de baixa (Pluggy vs ERP). Todas as APIs seguem padrões de segurança 
            com autenticação JWT, API Key multi-tenant ou HMAC conforme o caso, auditoria centralizada via 
            <code> api_security_log</code> e <code>erp_sync_log</code>, rate limiting via <code>ddos-shield</code>, 
            e monitoramento ativo via dashboard de saúde. O sistema suporta integrações com 
            <strong> Open Finance (BACEN)</strong>, <strong>WhatsApp Business</strong>, <strong>Google Maps/Places</strong>, 
            <strong> ElevenLabs</strong>, <strong>Gemini/GPT</strong> e <strong>plataformas de mídia social</strong>.
          </p>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p className="mt-1">BiMaster / Huggs CRM — Todos os direitos reservados</p>
            <p className="mt-1 font-mono">Classificação: CONFIDENCIAL</p>
          </div>
        </section>
      </div>
    </>
  );
};

export default RelatorioAPIs;

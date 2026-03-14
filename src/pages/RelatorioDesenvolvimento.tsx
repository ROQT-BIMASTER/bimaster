import { Button } from "@/components/ui/button";
import { Printer, Package, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RelatorioDesenvolvimento = () => {
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
          <Package className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground">
            Relatório Técnico — Ciclo de Vida do Produto
          </h1>
          <p className="text-xl text-muted-foreground mt-2">Sistema BiMaster / Huggs PLM</p>
          <div className="mt-4 inline-block bg-primary/10 text-primary font-bold text-lg px-6 py-3 rounded-lg">
            12 Estágios · 14 Módulos · Governança Completa China ↔ Brasil
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Documento Técnico — {new Date().toLocaleDateString('pt-BR')} — Versão 2.0
          </p>
        </div>

        {/* 1. RESUMO EXECUTIVO */}
        <section>
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            1. Resumo Executivo
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            O sistema implementa um <strong>PLM (Product Lifecycle Management) completo</strong> para gestão do ciclo 
            de vida de produtos cosméticos importados e nacionais — da concepção ao recebimento no Brasil. O fluxo abrange 
            <strong> 12 estágios obrigatórios</strong>, 14 módulos integrados, governança bilateral China ↔ Brasil 
            com interface bilíngue (PT/CN), e rastreabilidade total via EAN como chave universal.
          </p>
          <table className="w-full mt-4 border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-left text-foreground">Módulo</th>
                <th className="border p-2 text-center text-foreground">Status</th>
                <th className="border p-2 text-left text-foreground">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Pipeline 12 Estágios", "✅", "Fluxo completo com StatusPipeline visual e transições validadas"],
                ["Wizard Integrado", "✅", "Criação guiada de produto com vinculação automática a projetos"],
                ["Fábrica China — Workspace", "✅", "Checklist bilíngue, upload com preview, Focus Mode e workspace de produtividade"],
                ["Chat China ↔ Brasil", "✅", "Chat em tempo real com referência a produto/documento/checklist, replies e menções @"],
                ["Transferências Oficiais", "✅", "Painel de documentos oficializados e assinados eletronicamente entre equipes"],
                ["Ordens de Compra + Produção", "✅", "Emissão de OC, apontamentos de produção por cor e acompanhamento em tempo real"],
                ["Embarque + Logística", "✅", "Dados obrigatórios de container/BL, rastreamento e documentos de embarque"],
                ["Testes & Amostras", "✅", "5 tipos de teste (cor, fragrância, textura, aplicador, estabilidade)"],
                ["Checklist Embalagem", "✅", "12 itens estruturados com aprovação por item e upload de arquivos"],
                ["Pipeline ANVISA", "✅", "5 etapas regulatórias com rastreio de processo e datas"],
                ["Aprovação + RNC", "✅", "Aprovação física por 5 critérios + Registro de Não Conformidade"],
                ["Cofre de Documentos", "✅", "Versionamento de arquivos por projeto com controle de acesso"],
                ["Onboarding China → Brasil", "✅", "Transição de submissão China para cadastro nacional com herança de dados"],
                ["Ficha de Custo + Revisão", "✅", "Cálculo de custos com chat de revisão entre compras e diretoria"],
              ].map(([mod, status, desc]) => (
                <tr key={mod as string} className="border-b">
                  <td className="border p-2 font-medium text-foreground">{mod}</td>
                  <td className="border p-2 text-center">{status}</td>
                  <td className="border p-2 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 2. PROJETOS COMO MOTOR DO DESENVOLVIMENTO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            2. Projetos como Motor do Desenvolvimento
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O módulo de <strong>Projetos</strong> é o <strong>centro de comando</strong> de todo o ciclo de vida. 
              Cada produto nasce dentro de um projeto do tipo <em>"Desenvolvimento de Produto"</em>, que organiza 
              automaticamente equipes, tarefas, checklists e entregas de ponta a ponta.
            </p>

            <h3 className="font-bold">2.1 Hierarquia do Projeto</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                   HIERARQUIA DO PROJETO                                  │
  │                                                                           │
  │  📁 PROJETO (Desenvolvimento de Produto)                                 │
  │   │                                                                       │
  │   ├── 📂 SEÇÃO: Criação / Identidade                                     │
  │   │    ├── 📋 Tarefa PR-001: Definir identidade visual                   │
  │   │    │    ├── ☐ Subtarefa: Pesquisa de referências                     │
  │   │    │    └── ☐ Subtarefa: Criar mood board                            │
  │   │    └── 📋 Tarefa PR-002: Logo e paleta de cores                      │
  │   │         └── 🔗 Produto vinculado: Batom XYZ                          │
  │   │                                                                       │
  │   ├── 📂 SEÇÃO: Desenvolvimento de Embalagem                             │
  │   │    └── 📋 Tarefa PR-003: Definir faca primária                       │
  │   │         └── 🔗 Documento China vinculado (automático)                 │
  │   │                                                                       │
  │   └── 📂 SEÇÃO: Assuntos Regulatórios                                    │
  │        └── 📋 Tarefa PR-004: Montar dossiê ANVISA                        │
  └───────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">2.2 Vinculação de Membros por Papel</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Papel</th><th className="border p-2 text-left text-foreground">Responsabilidade</th><th className="border p-2 text-left text-foreground">Seções Visíveis</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Coordenador</td><td className="border p-2">Visão global, gerencia prazos e prioridades</td><td className="border p-2">Todas</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Gestor de Produto</td><td className="border p-2">Define escopo, vincula produtos, aprova entregas</td><td className="border p-2">Todas</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Membro</td><td className="border p-2">Executa tarefas atribuídas</td><td className="border p-2">Seções atribuídas</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. CICLO COMPLETO: COMEÇO, MEIO E FIM */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            3. Ciclo Completo — Começo, Meio e Fim
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold text-emerald-600">🟢 COMEÇO — Fase de Concepção</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       FASE 1: CONCEPÇÃO                                │
  │                                                                          │
  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │
  │  │ 🇧🇷 Brasil  │    │ 🇨🇳 China    │    │  Workspace   │                │
  │  │  identifica │───▶│  produz      │───▶│  Documentos  │                │
  │  │  oportunid. │    │  amostras    │    │  (checklist) │                │
  │  └─────────────┘    └──────────────┘    └──────┬───────┘                │
  │                                                │                        │
  │       ┌────────────────────────────────────────┤                        │
  │       │                                        │                        │
  │       ▼                                        ▼                        │
  │  ┌──────────────┐                    ┌──────────────────┐               │
  │  │ 🇨🇳 Upload   │                    │  💬 Chat China   │               │
  │  │ c/ Preview + │                    │  ↔ Brasil        │               │
  │  │ Focus Mode   │                    │  (tratativas)    │               │
  │  └──────┬───────┘                    └──────────────────┘               │
  │         │                                                               │
  │         ▼                                                               │
  │  ┌──────────────────┐     ┌──────────────────┐                          │
  │  │ 🇧🇷 Brasil revisa │     │ ✅ Oficializa +  │                          │
  │  │ aprova/rejeita   │────▶│ Assina Eletrôn.  │                          │
  │  │ documentos       │     │ → Transferência  │                          │
  │  └──────┬───────────┘     └──────────────────┘                          │
  │         │                                                               │
  │         ▼                                                               │
  │  ┌──────────────────┐                                                   │
  │  │ 🇧🇷 Emite Ordem   │                                                   │
  │  │ de Compra (OC)   │                                                   │
  │  └──────────────────┘                                                   │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold text-amber-600 mt-6">🟡 MEIO — Fase de Execução</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       FASE 2: EXECUÇÃO                                 │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────┐          │
  │  │      TAREFAS DISTRIBUÍDAS POR SEÇÃO (Multi-visão)         │          │
  │  │  Lista ──── Kanban ──── Gantt ──── Calendário              │          │
  │  └────────────────────────────────────────────────────────────┘          │
  │                           │                                              │
  │            ┌──────────────┼───────────────┐                              │
  │            ▼              ▼               ▼                              │
  │     ┌───────────┐  ┌───────────┐  ┌─────────────┐                       │
  │     │ 🧪 Testes │  │ 📦 Embal. │  │ 🛡️ ANVISA  │                       │
  │     │(paralelo) │  │(paralelo) │  │ (paralelo)  │                       │
  │     └─────┬─────┘  └─────┬─────┘  └──────┬──────┘                       │
  │           └──────────────┼───────────────┘                               │
  │                          ▼                                               │
  │  ┌────────────────────────────────────────────────────────────┐          │
  │  │  🇨🇳 PRODUÇÃO NA CHINA                                     │          │
  │  │  • Apontamentos por cor em tempo real                     │          │
  │  │  • Progress bar por OC com metas visuais                  │          │
  │  │  • Chat China ↔ Brasil para tratativas                    │          │
  │  └───────────────────────────────┬────────────────────────────┘          │
  │                                  ▼                                       │
  │  ┌────────────────────────────────────────────────────────────┐          │
  │  │  🚢 EMBARQUE OBRIGATÓRIO (após produção concluída)        │          │
  │  │  Container · BL · Porto · Navio · ETA · Peso · Volume     │          │
  │  │  Fotos do container + documentos de transporte             │          │
  │  └────────────────────────────────────────────────────────────┘          │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold text-blue-600 mt-6">🔵 FIM — Fase de Conclusão</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       FASE 3: CONCLUSÃO                                │
  │                                                                          │
  │  ┌───────────────┐    ┌───────────────┐    ┌──────────────┐             │
  │  │ 📋 Cadastro   │    │ ✅ Aprovação  │    │   RNC?       │             │
  │  │ Final         │───▶│ Física        │───▶│              │             │
  │  │ (7 validações)│    │ (5 critérios) │    │  ┌───┐ ┌───┐ │             │
  │  └───────────────┘    └───────────────┘    │  │Sim│ │Não│ │             │
  │                                            │  └─┬─┘ └─┬─┘ │             │
  │                                            └────┼─────┼───┘             │
  │                                                 │     │                  │
  │                                                 ▼     ▼                  │
  │                                          ┌──────────┐ ┌──────────┐      │
  │                                          │ Ação     │ │ Produto  │      │
  │                                          │ Corretiva│ │ avança   │      │
  │                                          │ (RNC)    │ │ pipeline │      │
  │                                          └──────────┘ └────┬─────┘      │
  │                                                            │             │
  │                                                            ▼             │
  │                                                     ┌────────────┐      │
  │                                                     │📥 Recebim. │      │
  │                                                     │Brasil+Lanç.│      │
  │                                                     └────────────┘      │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* 4. FÁBRICA CHINA — WORKSPACE DE DOCUMENTOS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            4. Fábrica China — Workspace de Documentos 🇨🇳
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O módulo da Fábrica China implementa um <strong>workspace de alta produtividade</strong> com interface 
              bilíngue (PT/CN) para gerenciamento completo de documentos, amostras e comunicação entre as equipes.
            </p>

            <h3 className="font-bold">4.1 Fluxo de Submissão</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │               FLUXO DE SUBMISSÃO CHINA → BRASIL                        │
  │                                                                          │
  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐            │
  │  │ 🇨🇳 Upload    │    │   Preview +   │    │  Caixa de     │            │
  │  │ Planilha Excel│───▶│ Extração IA   │───▶│  Validação    │            │
  │  │ + Fotos       │    │ (dados)       │    │  (aceite)     │            │
  │  └───────────────┘    └───────────────┘    └───────┬───────┘            │
  │                                                    │                    │
  │                          ┌──────────────────────────┤                    │
  │                          │                          │                    │
  │                          ▼                          ▼                    │
  │                ┌───────────────┐          ┌──────────────────┐           │
  │                │ Salvar como   │          │ Enviar ao Brasil │           │
  │                │ Rascunho 草稿 │          │ (status pendente)│           │
  │                └───────────────┘          └──────────────────┘           │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">4.2 Categorias de Documentos (Checklist Bilíngue)</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Fluxo</th>
                  <th className="border p-2 text-left text-foreground">Categoria</th>
                  <th className="border p-2 text-left text-foreground">中文</th>
                  <th className="border p-2 text-left text-foreground">Tipos</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">China → Brasil</td><td className="border p-2">Dados Oficiais</td><td className="border p-2">官方数据</td><td className="border p-2">Planilha Excel</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">China → Brasil</td><td className="border p-2">Fotos da Planilha</td><td className="border p-2">表格照片</td><td className="border p-2">8 campos de imagem da planilha</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">China → Brasil</td><td className="border p-2">Rotulagem</td><td className="border p-2">标签</td><td className="border p-2">Volumetria, Fórmula, Doc. Regulatória</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">China → Brasil</td><td className="border p-2">Embalagem</td><td className="border p-2">包装</td><td className="border p-2">Facas, Amostras (foto/vídeo)</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Brasil → China</td><td className="border p-2">Etiquetas</td><td className="border p-2">标签贴纸</td><td className="border p-2">Fundo, Tester, Bula</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Brasil → China</td><td className="border p-2">Artes e Design</td><td className="border p-2">设计稿</td><td className="border p-2">Arte Display</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Brasil → China</td><td className="border p-2">Códigos EAN</td><td className="border p-2">EAN条码</td><td className="border p-2">Unitário, Display, Caixa Master</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Brasil → China</td><td className="border p-2">Solicitação Amostras</td><td className="border p-2">样品请求</td><td className="border p-2">Fotos e vídeos de solicitação</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">4.3 Focus Mode (Workspace Tela Cheia)</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Sidebar com categorias navegáveis e contadores de status</li>
              <li>Cards com thumbnails e preview local antes do upload</li>
              <li>Submissão seletiva em lote (rascunho ou envio ao Brasil)</li>
              <li>Validação obrigatória com aceite formal pós-extração IA</li>
              <li>Edições pós-aceite protegidas por senha institucional</li>
            </ul>

            <h3 className="font-bold mt-4">4.4 Revisão e Aprovação pelo Brasil</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  Por documento:
  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────────┐
  │ Pendente │───▶│ Em Revisão│───▶│ Aprovado │    │  Oficializado│
  │          │    │           │    │          │───▶│ + Assinatura │
  └──────────┘    └─────┬─────┘    └──────────┘    │  Eletrônica  │
                        │                          └──────────────┘
                        ▼
                  ┌───────────┐    ┌──────────────┐
                  │ Rejeitado │───▶│ Contestação  │
                  │           │    │ (nova rodada)│
                  └───────────┘    └──────────────┘`}</pre>
          </div>
        </section>

        {/* 5. CHAT CHINA ↔ BRASIL */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            5. Chat In-line China ↔ Brasil 聊天
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Sistema de comunicação em tempo real integrado diretamente na ficha do produto, permitindo 
              <strong> tratativas contextualizadas</strong> entre as equipes China e Brasil com rastreabilidade total.
            </p>

            <h3 className="font-bold">5.1 Funcionalidades</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Feature</th>
                  <th className="border p-2 text-left text-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Bubbles por equipe</td><td className="border p-2">China (esquerda, vermelho) vs Brasil (direita, azul) — determinado automaticamente</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Referência contextual</td><td className="border p-2">Cada mensagem pode marcar: Produto, Item do Checklist ou Documento específico</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Replies (respostas)</td><td className="border p-2">Resposta direta a mensagens anteriores com quote visual</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Menções @</td><td className="border p-2">Autocomplete de perfis com avatar para mencionar colegas</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Read receipts</td><td className="border p-2">Marcação automática de leitura com ✓✓</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Realtime</td><td className="border p-2">Mensagens aparecem instantaneamente via WebSocket</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Lifecycle</td><td className="border p-2">Chat pode ser finalizado/reaberto pelo Brasil</td></tr>
              </tbody>
            </table>

            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  Tabela: china_chat_mensagens
  ┌──────────────────────────────────────────────────────────────┐
  │  submissao_id  │  FK → china_produto_submissoes              │
  │  usuario_id    │  Autor da mensagem                          │
  │  tipo          │  "china" | "brasil"                         │
  │  ref_tipo      │  "produto" | "checklist" | "documento"      │
  │  ref_id        │  ID do item referenciado                    │
  │  ref_label     │  Label legível (ex: "Faca Primária 初级刀模")│
  │  resposta_a_id │  Self-ref para replies                      │
  │  mencoes       │  JSONB com user_id + nome                   │
  │  lida_por      │  JSONB array de user_ids                    │
  └──────────────────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* 6. TRANSFERÊNCIAS OFICIAIS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            6. Transferências Oficiais ao Brasil 发送至巴西
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Painel centralizado que exibe todos os documentos que completaram o fluxo de <strong>oficialização + 
              assinatura eletrônica</strong>. Substitui o antigo conceito de "Arte Enviada" por uma visão completa 
              de transferências oficiais entre as equipes.
            </p>

            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  Fluxo de Oficialização:
  ┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────┐
  │ Upload   │───▶│ Revisão pelo │───▶│ Oficializado   │───▶│ Transferência│
  │ Documento│    │ Brasil       │    │ + Assinatura   │    │ Oficial      │
  │          │    │              │    │ Eletrônica ✍️   │    │ (badge ✅)   │
  └──────────┘    └──────────────┘    └────────────────┘    └──────────────┘

  Critério de exibição: oficializado = true AND assinado_por IS NOT NULL`}</pre>

            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Lista cada documento oficial: tipo, nome, quem assinou, data da assinatura</li>
              <li>Badge "Oficial" com download direto do arquivo</li>
              <li>EAN Caixa Master exibido quando disponível</li>
              <li>Card no painel principal com contador agregado de envios oficiais</li>
            </ul>
          </div>
        </section>

        {/* 7. ORDENS DE COMPRA + PRODUÇÃO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            7. Ordens de Compra + Produção na China 采购订单
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                FLUXO DE ORDEM DE COMPRA + PRODUÇÃO                     │
  │                                                                          │
  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐            │
  │  │ 🇧🇷 Brasil    │    │   OC criada   │    │ 🇨🇳 China     │            │
  │  │ Emite OC      │───▶│  (rascunho)   │───▶│ Recebe e      │            │
  │  │ (ficha prod.) │    │  aguard. aprov│    │ inicia prod.  │            │
  │  └───────────────┘    └───────────────┘    └───────┬───────┘            │
  │                                                    │                    │
  │                                                    ▼                    │
  │                                         ┌──────────────────┐            │
  │                                         │ 📊 Apontamentos  │            │
  │                                         │ por cor em tempo  │            │
  │                                         │ real (progress)   │            │
  │                                         └─────────┬────────┘            │
  │                                                   │                     │
  │                                      ┌────────────┴────────────┐        │
  │                                      │ Produção 100% concluída │        │
  │                                      └────────────┬────────────┘        │
  │                                                   │                     │
  │                                                   ▼                     │
  │                                         ┌──────────────────┐            │
  │                                         │ 🚢 EMBARQUE      │            │
  │                                         │ (obrigatório)    │            │
  │                                         │ Container, BL,   │            │
  │                                         │ Porto, ETA, etc. │            │
  │                                         └──────────────────┘            │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">7.1 Dados da OC</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">numero_oc</td><td className="border p-2">Código sequencial (ex: OC-2026-001)</td></tr>
                <tr><td className="border p-2 font-mono">produto_codigo / produto_nome</td><td className="border p-2">Produto vinculado à submissão</td></tr>
                <tr><td className="border p-2 font-mono">qty_total / qty_produzida</td><td className="border p-2">Meta e progresso de produção</td></tr>
                <tr><td className="border p-2 font-mono">status</td><td className="border p-2">rascunho → aprovada → em_producao → embarque_enviado → concluida</td></tr>
                <tr><td className="border p-2 font-mono">ean_caixa_master</td><td className="border p-2">EAN para rastreio de container</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">7.2 Apontamentos de Produção</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Registro por cor/variação com quantidade produzida</li>
              <li>Foto de evidência e campo de observação</li>
              <li>Lote de produção rastreável</li>
              <li>Progress bar visual com % por cor e total</li>
              <li>Atualização em tempo real via WebSocket</li>
            </ul>
          </div>
        </section>

        {/* 8. EMBARQUE + LOGÍSTICA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            8. Embarque + Logística — Dados Obrigatórios 🚢
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Após a conclusão da produção (100% das quantidades apontadas), a China <strong>deve obrigatoriamente</strong> 
              preencher todos os dados de embarque antes que a OC seja considerada finalizada. Este módulo garante a 
              rastreabilidade do container e o monitoramento da chegada ao Brasil.
            </p>

            <h3 className="font-bold">8.1 Campos Obrigatórios de Embarque</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Campo</th>
                  <th className="border p-2 text-left text-foreground">中文</th>
                  <th className="border p-2 text-left text-foreground">Descrição</th>
                  <th className="border p-2 text-center text-foreground">Obrig.</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["Nº Container", "集装箱号", "Código do container (ex: MSKU1234567)", "✅"],
                  ["Nº BL (Bill of Lading)", "提单号", "Número do conhecimento de embarque", "✅"],
                  ["Booking Number", "订舱号", "Número da reserva de espaço no navio", "—"],
                  ["Navio", "船名", "Nome da embarcação (ex: MSC OSCAR)", "—"],
                  ["Porto Origem", "起运港", "Porto de saída na China (8 opções pré-definidas)", "✅"],
                  ["Porto Destino", "目的港", "Porto de chegada no Brasil (6 opções pré-definidas)", "✅"],
                  ["Data Embarque", "装船日期", "Data efetiva de embarque", "✅"],
                  ["ETA (Chegada)", "预计到达日期", "Data estimada de chegada ao Brasil", "✅"],
                  ["Peso Total (kg)", "总重量", "Peso total do carregamento", "—"],
                  ["Volume (CBM)", "体积", "Volume em metros cúbicos", "—"],
                  ["Qtd Volumes", "件数", "Número total de volumes/caixas", "—"],
                  ["Modalidade", "运输方式", "FCL (Full Container) / LCL / Aéreo", "✅"],
                  ["Frete (USD)", "运费", "Valor do frete em dólares", "—"],
                  ["Fotos/Docs", "照片/文件", "Fotos do container carregado + documentos", "—"],
                ].map(([campo, cn, desc, obrig]) => (
                  <tr key={campo as string} className="border-b">
                    <td className="border p-2 font-medium text-foreground">{campo}</td>
                    <td className="border p-2 text-xs">{cn}</td>
                    <td className="border p-2">{desc}</td>
                    <td className="border p-2 text-center">{obrig}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="font-bold mt-4">8.2 Portos Pré-configurados</h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="font-medium text-foreground mb-1">🇨🇳 Portos de Origem:</p>
                <ul className="list-disc ml-6 text-muted-foreground">
                  <li>Shanghai 上海</li>
                  <li>Shenzhen 深圳</li>
                  <li>Ningbo 宁波</li>
                  <li>Guangzhou 广州</li>
                  <li>Qingdao 青岛</li>
                  <li>Xiamen 厦门</li>
                  <li>Tianjin 天津</li>
                  <li>Dalian 大连</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">🇧🇷 Portos de Destino:</p>
                <ul className="list-disc ml-6 text-muted-foreground">
                  <li>Santos</li>
                  <li>Paranaguá</li>
                  <li>Itajaí</li>
                  <li>Rio de Janeiro</li>
                  <li>Vitória</li>
                  <li>Suape</li>
                </ul>
              </div>
            </div>

            <h3 className="font-bold mt-4">8.3 Fluxo de Status do Embarque</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌──────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────────┐
  │ Rascunho │───▶│ Enviado  │───▶│ Em Trânsito      │───▶│ Recebido     │
  │ (salvar  │    │ (dados   │    │ (monitoramento)  │    │ no Brasil    │
  │  parcial)│    │  completos│   │                  │    │              │
  └──────────┘    └──────────┘    └──────────────────┘    └──────────────┘`}</pre>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-blue-500 mt-4">
              <strong>Regra de Negócio:</strong> A OC só pode ser marcada como "concluída" após o envio 
              dos dados de embarque com Container e BL preenchidos. O formulário aparece automaticamente 
              quando a produção atinge 100%.
            </div>
          </div>
        </section>

        {/* 9. PIPELINE DE 12 ESTÁGIOS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            9. Pipeline de 12 Estágios — Visão Completa
          </h2>
          <pre className="mt-4 bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE DO CICLO DE VIDA DO PRODUTO                        │
│                                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────────────┐      │
│  │  💡 IDEIA │───▶│ 📁 PROJ. │───▶│ 📄 PRÉ-CAD. │───▶│ 🔧 DESENVOLVIMENTO│      │
│  │          │    │ VINCULADO│    │              │    │                   │      │
│  └──────────┘    └──────────┘    └──────────────┘    └─────────┬─────────┘      │
│                                                               │                │
│  ┌──────────────────────────────────────────────────────────────┘                │
│  │                                                                              │
│  ▼                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │ 🧪 TESTES│───▶│ 📦 EMBAL.│───▶│ 🛡️ REGULAT. │───▶│ 📋 CAD. FINAL│           │
│  │          │    │          │    │   (ANVISA)   │    │              │           │
│  └──────────┘    └──────────┘    └──────────────┘    └──────┬───────┘           │
│                                                             │                  │
│  ┌──────────────────────────────────────────────────────────┘                    │
│  │                                                                              │
│  ▼                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                                   │
│  │ ✅ APROV.│───▶│ 🏭 PROD. │───▶│ 🚀 LANÇ. │                                   │
│  │          │    │ + EMBARQ.│    │          │                                   │
│  └──────────┘    └──────────┘    └──────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
          <table className="w-full mt-4 border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-left text-foreground">#</th>
                <th className="border p-2 text-left text-foreground">Estágio</th>
                <th className="border p-2 text-left text-foreground">Responsável</th>
                <th className="border p-2 text-left text-foreground">Pré-requisito de Transição</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["1", "Ideia", "Qualquer usuário", "Registro inicial do conceito"],
                ["2", "Projeto Vinculado", "Gestor de Produto", "Vinculação a projeto existente"],
                ["3", "Pré-Cadastro", "Equipe de Cadastro", "Campos de identificação Brasil"],
                ["4", "Desenvolvimento", "P&D / Design", "Formulação e especificações técnicas"],
                ["5", "Testes", "Laboratório / QA", "Amostras recebidas, 5 tipos de teste"],
                ["6", "Embalagem", "Design / Compras", "Checklist de 12 itens completo"],
                ["7", "Regulatório", "Equipe Regulatória", "Dossiê ANVISA submetido"],
                ["8", "Cadastro Final", "Cadastro + Regulatório", "7 validações obrigatórias"],
                ["9", "Aprovação", "QA / Diretoria", "5 critérios físicos aprovados"],
                ["10", "Produção", "Fábrica China", "OC emitida + apontamentos + embarque"],
                ["11", "Lançamento", "Comercial / Marketing", "Estoque recebido no Brasil"],
              ].map(([num, estagio, resp, prereq]) => (
                <tr key={num as string} className="border-b">
                  <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                  <td className="border p-2 font-medium text-foreground">{estagio}</td>
                  <td className="border p-2">{resp}</td>
                  <td className="border p-2">{prereq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 10. ONBOARDING CHINA → BRASIL */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            10. Onboarding China → Brasil (Cadastro Produto)
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Sistema PLM para transição da submissão China para o cadastro nacional brasileiro. Pode ser disparado 
              automaticamente ao vincular uma submissão a um projeto ou manualmente via "Novo Produto".
            </p>

            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
  │ Submissão China │     │ Vincula a Projeto│     │ Cria Produto Brasil  │
  │ (dados + fotos) │────▶│  (obrigatório p/ │────▶│  automaticamente     │
  │                 │     │   finalização)   │     │  (herda dados China) │
  └─────────────────┘     └──────────────────┘     └──────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">10.1 Dados Herdados</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Nome, Código, Categoria e Descrição do produto</li>
              <li>Fotos de referência (Image Timeline em 5 etapas)</li>
              <li>Grade de cores com EAN por SKU</li>
              <li>Pesos e medidas técnicas</li>
            </ul>

            <h3 className="font-bold mt-4">10.2 Interface Comparativa</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Tela lado a lado: dados China vs dados Brasil</li>
              <li>Image Timeline: China Source → Análise → Desenvolvimento → Aprovado → Marketing</li>
              <li>Checklist regulatório de 7 itens com validação bloqueante</li>
              <li>Histórico automático de atividades (logs, uploads, status)</li>
              <li>Grade de SKUs com drag-and-drop e composição Kit/Display</li>
            </ul>
          </div>
        </section>

        {/* 11. MÓDULO DE TESTES */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            11. Módulo de Testes e Amostras
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Tipo</th>
                  <th className="border p-2 text-left text-foreground">Critérios Avaliados</th>
                  <th className="border p-2 text-left text-foreground">Método</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Cor</td><td className="border p-2">Fidelidade ao pantone, uniformidade, cobertura</td><td className="border p-2">Visual + espectrofotômetro</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Fragrância</td><td className="border p-2">Intensidade, durabilidade, perfil olfativo</td><td className="border p-2">Painel sensorial</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Textura</td><td className="border p-2">Consistência, espalhabilidade, toque</td><td className="border p-2">Aplicação em pele</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Aplicador</td><td className="border p-2">Funcionalidade, ergonomia, dosagem</td><td className="border p-2">Teste funcional</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Estabilidade</td><td className="border p-2">Temperatura, luz, oxidação, separação</td><td className="border p-2">Câmara climática (90 dias)</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 12. EMBALAGEM */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            12. Desenvolvimento de Embalagem — Checklist de 12 Itens
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">#</th>
                  <th className="border p-2 text-left text-foreground">Item</th>
                  <th className="border p-2 text-left text-foreground">Responsável</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["1", "Faca Primária", "Design"],
                  ["2", "Faca Display", "Design"],
                  ["3", "Cartucho", "Design"],
                  ["4", "Tester/Provador", "Design"],
                  ["5", "Etiqueta Unitária", "Regulatório"],
                  ["6", "Etiqueta Display", "Regulatório"],
                  ["7", "Medidas Unitárias", "Engenharia"],
                  ["8", "Medidas Display", "Engenharia"],
                  ["9", "Peso Final", "QA"],
                  ["10", "Arte Final", "Design"],
                  ["11", "Mockup/Boneco", "Design"],
                  ["12", "Foto Catálogo", "Marketing"],
                ].map(([num, item, resp]) => (
                  <tr key={num as string} className="border-b">
                    <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                    <td className="border p-2 font-medium text-foreground">{item}</td>
                    <td className="border p-2">{resp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 13. PIPELINE ANVISA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            13. Pipeline Regulatório — ANVISA
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE REGULATÓRIO ANVISA                              │
│                                                                              │
│  ┌───────────┐    ┌───────────┐    ┌───────────────┐    ┌────────────┐      │
│  │  ANÁLISE  │    │  DOSSIÊ   │    │   ENVIADO     │    │    EM      │      │
│  │  TÉCNICA  │───▶│  MONTADO  │───▶│   À ANVISA    │───▶│ APROVAÇÃO  │      │
│  └───────────┘    └───────────┘    └───────────────┘    └─────┬──────┘      │
│                                                               ▼              │
│                                                        ┌────────────┐       │
│                                                        │  ✅ APROVADO│       │
│                                                        └────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘`}</pre>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-destructive/60 mt-4">
              <strong>Regra:</strong> Produtos Grau 2 exigem registro completo na ANVISA antes de avançar 
              para "Cadastro Final". Grau 1 necessitam apenas de notificação.
            </div>
          </div>
        </section>

        {/* 14. CADASTRO FINAL + APROVAÇÃO + RNC */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            14. Cadastro Final, Aprovação Física e RNC
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">14.1 Validações do Cadastro Final (7 itens bloqueantes)</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">#</th>
                  <th className="border p-2 text-left text-foreground">Validação</th>
                  <th className="border p-2 text-center text-foreground">Bloqueante</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["1", "ANVISA aprovado ou notificado", "✅"],
                  ["2", "NCM preenchido", "✅"],
                  ["3", "CEST preenchido (se aplicável)", "⚠️"],
                  ["4", "EAN unitário válido", "✅"],
                  ["5", "Peso líquido informado", "✅"],
                  ["6", "Validade em meses definida", "✅"],
                  ["7", "Arte final aprovada", "✅"],
                ].map(([num, validacao, bloq]) => (
                  <tr key={num as string} className="border-b">
                    <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                    <td className="border p-2">{validacao}</td>
                    <td className="border p-2 text-center">{bloq}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="font-bold mt-4">14.2 Critérios de Aprovação Física</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Critério</th>
                  <th className="border p-2 text-left text-foreground">O que é avaliado</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Cor</td><td className="border p-2">Correspondência com padrão aprovado</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Textura</td><td className="border p-2">Consistência e aplicação dentro do padrão</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Fragrância</td><td className="border p-2">Perfil olfativo conforme aprovação</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Rotulagem</td><td className="border p-2">Informações legais, idioma, composição</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Peso</td><td className="border p-2">Peso líquido dentro da tolerância (±5%)</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">14.3 Fluxo de Não Conformidade (RNC)</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌────────────┐    ┌──────────┐    ┌───────────────┐    ┌──────────────┐
  │ Avaliação  │    │  Gera    │    │   Notifica    │    │ Ação         │
  │ Negativa   │───▶│  RNC     │───▶│  Fornecedor   │───▶│ Corretiva    │
  └────────────┘    └──────────┘    └───────────────┘    └──────┬───────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                             ┌────────────┐       ┌────────────┐
                                             │ ✅ Resolvida│       │ ❌ Escalada │
                                             └────────────┘       └────────────┘`}</pre>
          </div>
        </section>

        {/* 15. FICHA DE CUSTO + REVISÃO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            15. Ficha de Custo + Chat de Revisão
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Módulo de precificação com chat profissional entre Compras/Faturamento e Diretoria. O chat segue o padrão 
              "Professional Chat" com sides fixos (Compras à esquerda, Diretoria à direita em azul).
            </p>

            <h3 className="font-bold">15.1 Funcionalidades do Chat de Revisão</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Replies com quote visual e menções @ com autocomplete</li>
              <li>Contextualização por insumo/matéria-prima específica</li>
              <li>Anexos com envio direto ao Cofre de Documentos</li>
              <li>Read receipts e separadores de data</li>
              <li>Lifecycle: aberto → finalizado (pela diretoria)</li>
              <li>Painel lateral com Cofre de Documentos do produto</li>
              <li>Histórico consolidado multi-versão (todas revisões)</li>
            </ul>
          </div>
        </section>

        {/* 16. RASTREABILIDADE EAN */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            16. Rastreabilidade Universal por EAN
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O EAN é a <strong>chave universal de rastreabilidade</strong> que unifica produtos entre China e Brasil.
            </p>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Nível</th>
                  <th className="border p-2 text-left text-foreground">Tipo EAN</th>
                  <th className="border p-2 text-left text-foreground">Escopo</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Produto</td><td className="border p-2">EAN Display + EAN Caixa Master</td><td className="border p-2">Nível global do produto</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">SKU</td><td className="border p-2">EAN Unidade</td><td className="border p-2">Por cor/variação na grade</td></tr>
              </tbody>
            </table>
            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary mt-4">
              <strong>Validação:</strong> Unicidade em tempo real durante a submissão para evitar duplicidade.
            </div>
          </div>
        </section>

        {/* 17. CONTROLE DE ACESSO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            17. Controle de Acesso por Papel
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Papel</th>
                  <th className="border p-2 text-left text-foreground">Fases de Atuação</th>
                  <th className="border p-2 text-left text-foreground">Permissões</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Gestor de Produto</td><td className="border p-2">Ideia → Lançamento</td><td className="border p-2">Criar, editar, vincular, priorizar</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Equipe China 🇨🇳</td><td className="border p-2">Submissão, Produção, Embarque</td><td className="border p-2">Upload, apontamentos, embarque, chat</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Equipe Brasil 🇧🇷</td><td className="border p-2">Revisão, Aprovação, OC</td><td className="border p-2">Aprovar/rejeitar, emitir OC, oficializar</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Equipe Regulatória</td><td className="border p-2">Regulatório, Cadastro Final</td><td className="border p-2">Dossiê ANVISA, checklist regulatório</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Design</td><td className="border p-2">Desenvolvimento, Embalagem</td><td className="border p-2">Artes, mockups, catálogo</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">QA (Qualidade)</td><td className="border p-2">Testes, Aprovação</td><td className="border p-2">Testes, critérios físicos, RNC</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Diretoria</td><td className="border p-2">Aprovação, Ficha de Custo</td><td className="border p-2">Aprovação final, revisão de custos</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Admin</td><td className="border p-2">Todas</td><td className="border p-2">Acesso total, cofre, templates, configurações</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 18. MÉTRICAS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            18. Métricas e Indicadores (KPIs)
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">KPI</th>
                  <th className="border p-2 text-left text-foreground">Fórmula / Fonte</th>
                  <th className="border p-2 text-left text-foreground">Meta</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Lead Time Total</td><td className="border p-2">Ideia → Lançamento</td><td className="border p-2">{"< 120 dias"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Tempo Médio por Estágio</td><td className="border p-2">Timestamps de transição</td><td className="border p-2">{"< 15 dias"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Taxa Aprovação Testes</td><td className="border p-2">Aprovados / total × 100</td><td className="border p-2">{"> 80%"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">RNCs Abertas</td><td className="border p-2">RNCs com status ≠ resolvida</td><td className="border p-2">{"< 5"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Tempo Médio ANVISA</td><td className="border p-2">Envio → Aprovação</td><td className="border p-2">{"< 60d (G1), < 180d (G2)"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Tempo Produção → Embarque</td><td className="border p-2">OC aprovada → embarque enviado</td><td className="border p-2">{"< 30 dias"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Tempo Trânsito</td><td className="border p-2">Data embarque → ETA</td><td className="border p-2">{"< 45 dias (marítimo)"}</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Docs Oficializados</td><td className="border p-2">Documentos com assinatura eletrônica</td><td className="border p-2">100% antes da OC</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 19. CONCLUSÃO */}
        <section className="page-break border-t-4 border-primary pt-6 mt-8">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            19. Conclusão
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-3">
            <p className="text-muted-foreground leading-relaxed">
              O sistema BiMaster/Huggs implementa um <strong>PLM completo e bilíngue</strong> para 
              gestão do ciclo de vida de produtos cosméticos, abrangendo desde a concepção até o recebimento no Brasil.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Com <strong>12 estágios obrigatórios</strong>, <strong>14 módulos integrados</strong>, governança bilateral 
              China ↔ Brasil, chat em tempo real, workspace de documentos com Focus Mode, embarque obrigatório 
              com rastreamento de container, e rastreabilidade universal por EAN, o sistema garante:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><strong>Rastreabilidade total</strong> — Cada decisão, teste, documento e embarque registrado com timestamp e responsável</li>
              <li><strong>Governança bilateral</strong> — Interface bilíngue (PT/CN) com chat contextualizado e sides fixos por equipe</li>
              <li><strong>Conformidade regulatória</strong> — Pipeline ANVISA + checklists de validação bloqueantes</li>
              <li><strong>Qualidade assegurada</strong> — 5 critérios físicos + RNC + oficialização com assinatura eletrônica</li>
              <li><strong>Logística rastreável</strong> — Embarque obrigatório com container, BL, portos e ETA monitorados</li>
              <li><strong>Eficiência operacional</strong> — Wizard, herança de dados, briefing IA, Focus Mode e realtime</li>
            </ul>
            <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="font-bold text-foreground">Sistema BiMaster / Huggs PLM — Versão 2.0</p>
              <p className="text-muted-foreground mt-1">
                Relatório gerado em {new Date().toLocaleDateString('pt-BR')} — Documento técnico para análise interna
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default RelatorioDesenvolvimento;

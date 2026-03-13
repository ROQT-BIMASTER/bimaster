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
            12 Estágios · 8 Módulos · Governança Completa
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Documento Técnico — {new Date().toLocaleDateString('pt-BR')} — Versão 1.0
          </p>
        </div>

        {/* 1. RESUMO EXECUTIVO */}
        <section>
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            1. Resumo Executivo
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            O sistema implementa um <strong>PLM (Product Lifecycle Management)</strong> completo para gestão do ciclo 
            de vida de produtos cosméticos — da concepção à comercialização. O fluxo abrange <strong>12 estágios obrigatórios</strong>, 
            6 módulos integrados e governança por papéis com validação de pré-requisitos entre etapas.
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
                ["Pipeline 12 Estágios", "✅ Ativo", "Fluxo completo com StatusPipeline visual e transições validadas"],
                ["Wizard Integrado", "✅ Ativo", "Criação guiada de produto com vinculação automática a projetos"],
                ["Testes & Amostras", "✅ Ativo", "5 tipos de teste (cor, fragrância, textura, aplicador, estabilidade)"],
                ["Checklist Embalagem", "✅ Ativo", "12 itens estruturados com aprovação por item e upload de arquivos"],
                ["Pipeline ANVISA", "✅ Ativo", "5 etapas regulatórias com rastreio de processo e datas"],
                ["Aprovação + RNC", "✅ Ativo", "Aprovação física por 5 critérios + Registro de Não Conformidade"],
              ].map(([mod, status, desc]) => (
                <tr key={mod} className="border-b">
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
              O módulo de <strong>Projetos</strong> é o <strong>centro de comando</strong> de todo o ciclo de vida do produto. 
              Cada produto nasce dentro de um projeto do tipo <em>"Desenvolvimento de Produto"</em>, que organiza automaticamente 
              as equipes, tarefas e entregas de ponta a ponta.
            </p>

            <h3 className="font-bold">2.1 Criação do Projeto</h3>
            <p className="text-muted-foreground">
              O wizard de criação gera automaticamente seções departamentais com base no template selecionado:
            </p>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  Template: "Desenvolvimento de Produto"
  ┌────────────────────────────────────────────────────────────────┐
  │  Seções geradas automaticamente:                              │
  │                                                                │
  │  1. Criação / Identidade          (Design)                    │
  │  2. Desenvolvimento de Produtos   (P&D)                       │
  │  3. Desenvolvimento de Embalagem  (Design / Engenharia)       │
  │  4. Informações dos Produtos      (Cadastro / Briefing)       │
  │  5. Assuntos Regulatórios         (Regulatório)               │
  │  6. Criação / Artes               (Design / Marketing)        │
  └────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">2.2 Campos Obrigatórios do Projeto</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Marca</td><td className="border p-2">Ruby Rose, HB, Maiana ou Outra</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Categoria / Linha</td><td className="border p-2">Maquiagem, Skincare, Corpo, etc.</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Origem</td><td className="border p-2">China (Importação), Brasil (Nacional), Collab, Recompra</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">2.3 Vinculação de Membros por Papel</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Papel</th><th className="border p-2 text-left text-foreground">Responsabilidade</th><th className="border p-2 text-left text-foreground">Seções Visíveis</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Coordenador</td><td className="border p-2">Visão global, gerencia prazos e prioridades</td><td className="border p-2">Todas</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Gestor de Produto</td><td className="border p-2">Define escopo, vincula produtos, aprova entregas</td><td className="border p-2">Todas</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Membro</td><td className="border p-2">Executa tarefas atribuídas</td><td className="border p-2">Seções atribuídas</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">2.4 Hierarquia do Projeto</h3>
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
  │   │         └── 🔗 Produto vinculado: Batom XYZ                          │
  │   │                                                                       │
  │   └── 📂 SEÇÃO: Assuntos Regulatórios                                    │
  │        └── 📋 Tarefa PR-004: Montar dossiê ANVISA                        │
  │             └── 🔗 Produto vinculado: Batom XYZ                          │
  └───────────────────────────────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* 3. CICLO COMPLETO: COMEÇO, MEIO E FIM */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            3. Ciclo Completo — Começo, Meio e Fim
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O desenvolvimento de um produto segue <strong>3 fases distintas</strong>, cada uma com entregas, responsáveis e 
              marcos específicos. O projeto do tipo "Desenvolvimento de Produto" orquestra todo o processo.
            </p>

            <h3 className="font-bold text-emerald-600">🟢 COMEÇO — Fase de Concepção</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       FASE 1: CONCEPÇÃO                                │
  │                                                                          │
  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │
  │  │ 🇧🇷 Brasil  │    │  Template    │    │  Seções      │                │
  │  │  identifica │───▶│  gera seções │───▶│  automáticas │                │
  │  │  oportunid. │    │  por depto   │    │  + membros   │                │
  │  └─────────────┘    └──────────────┘    └──────┬───────┘                │
  │                                                │                        │
  │       ┌────────────────────────────────────────┤                        │
  │       │                                        │                        │
  │       ▼                                        ▼                        │
  │  ┌──────────────┐                    ┌──────────────────┐               │
  │  │ 🇧🇷 Registra │                    │  📝 Briefing IA  │               │
  │  │ Submissão c/ │                    │  gerado por      │               │
  │  │ dados produto│                    │  tarefa          │               │
  │  └──────┬───────┘                    └──────────────────┘               │
  │         │                                                               │
  │         ▼                                                               │
  │  ┌──────────────────┐                                                   │
  │  │ 🇨🇳 China recebe  │                                                   │
  │  │ demanda e produz │                                                   │
  │  │ amostras         │                                                   │
  │  └────────┬─────────┘                                                   │
  │           │                                                             │
  │           ▼                                                             │
  │  ┌──────────────────────┐                                               │
  │  │ 🇨🇳 China envia docs │                                               │
  │  │ e amostras para      │                                               │
  │  │ aprovação Brasil     │                                               │
  │  └────────┬─────────────┘                                               │
  │           │                                                             │
  │           ▼                                                             │
  │  ┌──────────────────────┐                                               │
  │  │ 🇧🇷 Brasil confere   │                                               │
  │  │ ✅ Checklist         │                                               │
  │  │ 📋 Docs + Produto   │                                               │
  │  │ 🔒 Libera produção  │                                               │
  │  └────────┬─────────────┘                                               │
  │           │                                                             │
  │           ▼                                                             │
  │  ┌──────────────────────┐                                               │
  │  │ 🇧🇷 Emite Ordem de   │                                               │
  │  │ Compra (OC) p/ China │                                               │
  │  │ Ex: OC-2026-001      │                                               │
  │  └────────┬─────────────┘                                               │
  │           │                                                             │
  │           ▼                                                             │
  │  ┌──────────────────────┐                                               │
  │  │ 🇨🇳 China produz     │                                               │
  │  │ 📊 Apontamentos      │                                               │
  │  │ 📦 Embarque → Brasil │                                               │
  │  └──────────────────────┘                                               │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Equipe Brasil identifica oportunidade (viagem à China, pesquisa de tendência, demanda comercial)</li>
              <li>Submissão registrada no sistema com dados do produto desejado</li>
              <li>China recebe a demanda e produz amostras/protótipos</li>
              <li><strong>China envia documentos e amostras para aprovação do Brasil</strong></li>
              <li><strong>Brasil confere via Checklist: documentos, produto físico e conformidade</strong></li>
              <li><strong>Produção só é liberada após aprovação formal do Brasil</strong></li>
              <li>Briefing IA gerado por tarefa com dados estruturados da planilha</li>
            </ul>

            <h3 className="font-bold text-amber-600 mt-6">🟡 MEIO — Fase de Execução</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                       FASE 2: EXECUÇÃO                                 │
  │                                                                          │
  │  ┌────────────────────────────────────────────────────────────┐          │
  │  │               TAREFAS DISTRIBUÍDAS POR SEÇÃO               │          │
  │  │                                                            │          │
  │  │  Lista ──── Kanban ──── Gantt ──── Calendário              │          │
  │  │  (visões simultâneas dos mesmos dados)                     │          │
  │  └────────────────────────────────────────────────────────────┘          │
  │                           │                                              │
  │            ┌──────────────┼───────────────┐                              │
  │            │              │               │                              │
  │            ▼              ▼               ▼                              │
  │     ┌───────────┐  ┌───────────┐  ┌─────────────┐                       │
  │     │ 🧪 Testes │  │ 📦 Embal. │  │ 🛡️ ANVISA  │                       │
  │     │(paralelo) │  │(paralelo) │  │ (paralelo)  │                       │
  │     └─────┬─────┘  └─────┬─────┘  └──────┬──────┘                       │
  │           │              │               │                               │
  │           └──────────────┼───────────────┘                               │
  │                          ▼                                               │
  │                   ┌─────────────┐                                        │
  │                   │  Validação  │                                        │
  │                   │ Checklist + │                                        │
  │                   │ Auditoria IA│                                        │
  │                   └─────────────┘                                        │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Tarefas distribuídas por seções com 4 visões: Lista, Kanban, Gantt e Calendário</li>
              <li>Cada tarefa pode ter produto vinculado com StatusPipeline visual</li>
              <li>Focus Mode permite ver painel do produto lado a lado com a tarefa</li>
              <li>Testes, Embalagem e ANVISA executados em paralelo por equipes diferentes</li>
              <li>Fluxo: tarefa concluída → Enviar para Validação → Checklist + Auditoria IA</li>
            </ul>

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
  │                                                     │ 🏭 Produção│      │
  │                                                     │ 🚀 Lanç.  │      │
  │                                                     └────────────┘      │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Cadastro Final com 7 validações bloqueantes (ANVISA, NCM, EAN, etc.)</li>
              <li>Aprovação física por 5 critérios: cor, textura, fragrância, rótulo, peso</li>
              <li>Se não conforme → gera RNC com ação corretiva obrigatória</li>
              <li>Tarefa validada → produto avança no pipeline automaticamente</li>
              <li>Projeto finalizado quando todos os produtos atingem status "Lançamento"</li>
            </ul>
          </div>
        </section>

        {/* 4. ESTRUTURA DE TAREFAS E GOVERNANÇA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            4. Estrutura de Tarefas e Governança
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              As tarefas são o elo entre o projeto e os produtos. Cada tarefa segue um fluxo de validação 
              que depende do tipo de projeto em que está inserida.
            </p>

            <h3 className="font-bold">4.1 Código Automático</h3>
            <p className="text-muted-foreground">
              Cada tarefa criada recebe um código sequencial automático (ex: <code>PR-001</code>, <code>PR-002</code>) 
              que garante rastreabilidade e referência rápida em reuniões e relatórios.
            </p>

            <h3 className="font-bold mt-4">4.2 Fluxo de Validação — Projeto de Desenvolvimento</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │             FLUXO DE VALIDAÇÃO (Desenvolvimento de Produto)            │
  │                                                                          │
  │  ┌───────────┐    ┌──────────────┐    ┌──────────────┐                  │
  │  │  Tarefa   │    │   Enviar p/  │    │  Checklist   │                  │
  │  │ Concluída │───▶│  Validação   │───▶│  Obrigatório │                  │
  │  │           │    │              │    │  (itens)     │                  │
  │  └───────────┘    └──────────────┘    └──────┬───────┘                  │
  │                                              │                          │
  │                                              ▼                          │
  │                                     ┌──────────────┐                    │
  │                                     │ 🤖 Auditoria │                    │
  │                                     │     IA       │                    │
  │                                     │ (consistência│                    │
  │                                     │  tarefa ↔    │                    │
  │                                     │  produto)    │                    │
  │                                     └──────┬───────┘                    │
  │                                            │                            │
  │                                 ┌──────────┴──────────┐                 │
  │                                 │                     │                 │
  │                                 ▼                     ▼                 │
  │                          ┌────────────┐        ┌────────────┐           │
  │                          │ ✅ Aprovada │        │ ❌ Rejeitada│           │
  │                          │ (produto   │        │ (volta ao  │           │
  │                          │  avança)   │        │  executor) │           │
  │                          └────────────┘        └────────────┘           │
  └──────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold mt-4">4.3 Fluxo de Validação — Projeto Genérico</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌───────────┐    ┌──────────────────┐    ┌──────────────┐
  │  Tarefa   │    │  Enviar ao       │    │  Supervisor  │
  │ Concluída │───▶│  Superior        │───▶│  Aprova ou   │
  │           │    │  (reatribui)     │    │  Devolve     │
  └───────────┘    └──────────────────┘    └──────────────┘`}</pre>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary mt-4">
              <strong>Diferença-chave:</strong> Em projetos de <em>Desenvolvimento de Produto</em>, a validação exige 
              produto vinculado + checklist + auditoria IA. Em projetos <em>Genéricos</em>, a validação é hierárquica 
              (envia ao supervisor para aprovação).
            </div>
          </div>
        </section>

        {/* 5. PIPELINE DE 12 ESTÁGIOS */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            5. Pipeline de 12 Estágios — Visão Completa
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
│  │          │    │          │    │          │                                   │
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
                ["1", "Ideia", "Qualquer usuário", "Registro inicial do conceito do produto"],
                ["2", "Projeto Vinculado", "Gestor de Produto", "Vinculação obrigatória a um projeto existente"],
                ["3", "Pré-Cadastro", "Equipe de Cadastro", "Preenchimento dos campos de identificação Brasil"],
                ["4", "Desenvolvimento", "P&D / Design", "Formulação definida, especificações técnicas"],
                ["5", "Testes", "Laboratório / QA", "Amostras recebidas, testes de cor/fragrância/textura"],
                ["6", "Embalagem", "Design / Compras", "Checklist de 12 itens completo (faca, display, cartucho)"],
                ["7", "Regulatório", "Equipe Regulatória", "Dossiê ANVISA montado e submetido"],
                ["8", "Cadastro Final", "Cadastro + Regulatório", "7 validações obrigatórias + EAN/NCM preenchidos"],
                ["9", "Aprovação", "QA / Diretoria", "Aprovação física por 5 critérios (cor, textura, fragrância, rótulo, peso)"],
                ["10", "Produção", "Fábrica / China", "Ordem de compra emitida, produção iniciada"],
                ["11", "Lançamento", "Comercial / Marketing", "Estoque disponível, material de marketing pronto"],
              ].map(([num, estagio, resp, prereq]) => (
                <tr key={num} className="border-b">
                  <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                  <td className="border p-2 font-medium text-foreground">{estagio}</td>
                  <td className="border p-2">{resp}</td>
                  <td className="border p-2">{prereq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 3. ORIGEM DA DEMANDA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            6. Origem da Demanda — Fase Ideia/Projeto
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <div>
              <h3 className="font-bold">6.1 Fontes de Demanda</h3>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
                <li><strong>Viagem à China</strong> — Equipe Brasil visita feiras/fábricas, identifica oportunidades e registra demandas via submissão</li>
                <li><strong>Pesquisa de Tendência</strong> — Análise de mercado, benchmarking de concorrentes</li>
                <li><strong>Diretoria / Comercial</strong> — Demandas estratégicas de portfólio</li>
                <li><strong>Desenvolvimento Interno</strong> — Formulações novas da fábrica própria</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold">6.2 Wizard de Criação Automática</h3>
              <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
  │ Submissão China │     │ Vincula a Projeto│     │ Cria Produto Brasil  │
  │ (dados + fotos) │────▶│  (obrigatório)   │────▶│  automaticamente     │
  └─────────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────────┐
                                                    │ Herda dados China:   │
                                                    │ • Nome, Código       │
                                                    │ • Categoria          │
                                                    │ • Descrição          │
                                                    │ • Fotos de referência│
                                                    │ • Grade de cores     │
                                                    └──────────────────────┘`}</pre>
            </div>
            <div>
              <h3 className="font-bold">6.3 Campos do Projeto</h3>
              <ul className="list-disc ml-6 mt-2 space-y-1 text-muted-foreground">
                <li><strong>Marca</strong> — Seleção da marca destino (multimarca suportado)</li>
                <li><strong>Categoria</strong> — Classificação por linha de produto</li>
                <li><strong>Origem</strong> — Importado (China) ou Nacional (Fábrica própria)</li>
                <li><strong>Template</strong> — Modelo de seções e tarefas pré-configuradas</li>
                <li><strong>Briefing IA</strong> — Geração automática de briefing técnico por inteligência artificial</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 4. PRÉ-CADASTRO DO PRODUTO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            7. Pré-Cadastro do Produto — Campos Detalhados
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground">
              A tabela <code>produtos_brasil</code> contém <strong>50+ campos</strong> organizados em categorias 
              para rastrear cada aspecto do produto ao longo do ciclo de vida.
            </p>

            <h3 className="font-bold">7.1 Identificação</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Tipo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">nome_brasil</td><td className="border p-2">text</td><td className="border p-2">Nome comercial do produto no Brasil</td></tr>
                <tr><td className="border p-2 font-mono">codigo_brasil</td><td className="border p-2">text</td><td className="border p-2">Código interno de referência</td></tr>
                <tr><td className="border p-2 font-mono">categoria_brasil</td><td className="border p-2">text</td><td className="border p-2">Categoria de produto (batom, pó, etc.)</td></tr>
                <tr><td className="border p-2 font-mono">descricao_brasil</td><td className="border p-2">text</td><td className="border p-2">Descrição detalhada para cadastro</td></tr>
                <tr><td className="border p-2 font-mono">marca</td><td className="border p-2">text</td><td className="border p-2">Marca destino do produto</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">7.2 Classificação Fiscal e Regulatória</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Tipo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">ncm</td><td className="border p-2">text</td><td className="border p-2">Nomenclatura Comum do Mercosul</td></tr>
                <tr><td className="border p-2 font-mono">cest</td><td className="border p-2">text</td><td className="border p-2">Código Especificador da Substituição Tributária</td></tr>
                <tr><td className="border p-2 font-mono">tipo_produto_anvisa</td><td className="border p-2">text</td><td className="border p-2">Grau 1 ou Grau 2 (classificação ANVISA)</td></tr>
                <tr><td className="border p-2 font-mono">numero_processo_anvisa</td><td className="border p-2">text</td><td className="border p-2">Número do processo regulatório</td></tr>
                <tr><td className="border p-2 font-mono">validade_meses</td><td className="border p-2">integer</td><td className="border p-2">Prazo de validade em meses</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">7.3 Embalagem e Medidas</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Tipo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">peso_liquido_g</td><td className="border p-2">numeric</td><td className="border p-2">Peso líquido em gramas</td></tr>
                <tr><td className="border p-2 font-mono">peso_bruto_g</td><td className="border p-2">numeric</td><td className="border p-2">Peso bruto incluindo embalagem</td></tr>
                <tr><td className="border p-2 font-mono">dimensoes</td><td className="border p-2">jsonb</td><td className="border p-2">Altura × Largura × Profundidade (mm)</td></tr>
                <tr><td className="border p-2 font-mono">ean_unidade</td><td className="border p-2">text</td><td className="border p-2">Código de barras EAN unitário</td></tr>
                <tr><td className="border p-2 font-mono">ean_display</td><td className="border p-2">text</td><td className="border p-2">Código de barras EAN do display</td></tr>
                <tr><td className="border p-2 font-mono">ean_caixa_master</td><td className="border p-2">text</td><td className="border p-2">Código de barras EAN da caixa master</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">7.4 Dados de Origem China</h3>
            <table className="w-full border-collapse mt-2">
              <thead><tr className="bg-muted"><th className="border p-2 text-left text-foreground">Campo</th><th className="border p-2 text-left text-foreground">Descrição</th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">china_nome</td><td className="border p-2">Nome original do produto na fábrica chinesa</td></tr>
                <tr><td className="border p-2 font-mono">china_codigo</td><td className="border p-2">Código do fornecedor chinês</td></tr>
                <tr><td className="border p-2 font-mono">china_categoria</td><td className="border p-2">Categoria original na China</td></tr>
                <tr><td className="border p-2 font-mono">submissao_china_id</td><td className="border p-2">Vínculo com a submissão original (FK)</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 8. MÓDULO DE TESTES */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            8. Módulo de Testes e Amostras
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DO MÓDULO DE TESTES                              │
│                                                                              │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                │
│  │   AMOSTRA     │    │   AMOSTRA     │    │   EM TESTE    │                │
│  │  SOLICITADA   │───▶│   RECEBIDA    │───▶│  (Laboratório)│                │
│  └───────────────┘    └───────────────┘    └───────┬───────┘                │
│                                                    │                        │
│                                         ┌──────────┴──────────┐             │
│                                         │                     │             │
│                                         ▼                     ▼             │
│                                  ┌─────────────┐      ┌─────────────┐      │
│                                  │  ✅ APROVADA │      │  ❌ REPROVADA│      │
│                                  │             │      │             │      │
│                                  └─────────────┘      └──────┬──────┘      │
│                                                              │              │
│                                                              ▼              │
│                                                       ┌─────────────┐      │
│                                                       │  🔄 AJUSTE  │      │
│                                                       │ (nova rodada)│      │
│                                                       └─────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold">8.1 Tipos de Teste</h3>
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

            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary mt-4">
              <strong>Rastreabilidade:</strong> Cada teste registra avaliador, data, resultado (aprovado/reprovado/ajuste), 
              observações e fotos da amostra. O histórico completo é mantido na tabela <code>produto_testes</code>.
            </div>
          </div>
        </section>

        {/* 9. DESENVOLVIMENTO DE EMBALAGEM */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            9. Desenvolvimento de Embalagem — Checklist Estruturado
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground">
              O checklist de embalagem contém <strong>12 itens obrigatórios</strong>, cada um com status individual 
              (pendente, em andamento, aprovado) e possibilidade de upload de arquivo comprobatório.
            </p>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">#</th>
                  <th className="border p-2 text-left text-foreground">Item</th>
                  <th className="border p-2 text-left text-foreground">Descrição</th>
                  <th className="border p-2 text-left text-foreground">Responsável</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["1", "Faca Primária", "Molde de corte da embalagem primária (blister, cartela)", "Design"],
                  ["2", "Faca Display", "Molde de corte do display de exposição", "Design"],
                  ["3", "Cartucho", "Caixa individual do produto", "Design"],
                  ["4", "Tester/Provador", "Embalagem do tester para PDV", "Design"],
                  ["5", "Etiqueta Unitária", "Rótulo do produto unitário", "Regulatório"],
                  ["6", "Etiqueta Display", "Rótulo do display", "Regulatório"],
                  ["7", "Medidas Unitárias", "Dimensões finais do produto embalado", "Engenharia"],
                  ["8", "Medidas Display", "Dimensões do display montado", "Engenharia"],
                  ["9", "Peso Final", "Peso líquido e bruto confirmados", "QA"],
                  ["10", "Arte Final", "Arquivo fechado para impressão", "Design"],
                  ["11", "Mockup/Boneco", "Protótipo físico da embalagem", "Design"],
                  ["12", "Foto Catálogo", "Foto profissional para e-commerce e catálogo", "Marketing"],
                ].map(([num, item, desc, resp]) => (
                  <tr key={num} className="border-b">
                    <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                    <td className="border p-2 font-medium text-foreground">{item}</td>
                    <td className="border p-2">{desc}</td>
                    <td className="border p-2">{resp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  Fluxo por Item:
  ┌──────────┐    ┌───────────────┐    ┌──────────┐    ┌──────────┐
  │ Pendente │───▶│ Em Andamento  │───▶│ Upload   │───▶│ Aprovado │
  └──────────┘    └───────────────┘    │ Arquivo  │    └──────────┘
                                       └──────────┘`}</pre>
          </div>
        </section>

        {/* 10. PIPELINE REGULATÓRIO ANVISA */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            10. Pipeline Regulatório — ANVISA
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE REGULATÓRIO ANVISA                              │
│                                                                              │
│  ┌───────────┐    ┌───────────┐    ┌───────────────┐    ┌────────────┐      │
│  │  ANÁLISE  │    │  DOSSIÊ   │    │   ENVIADO     │    │    EM      │      │
│  │  TÉCNICA  │───▶│  MONTADO  │───▶│   À ANVISA    │───▶│ APROVAÇÃO  │      │
│  │           │    │           │    │               │    │            │      │
│  └───────────┘    └───────────┘    └───────────────┘    └─────┬──────┘      │
│                                                               │              │
│       Classificação     Documentos        Protocolo         Aguarda         │
│       Grau 1 / Grau 2   técnicos         registrado        parecer          │
│                                                               │              │
│                                                               ▼              │
│                                                        ┌────────────┐       │
│                                                        │  ✅ APROVADO│       │
│                                                        │   ANVISA   │       │
│                                                        └────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘`}</pre>

            <h3 className="font-bold">10.1 Campos Rastreados</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Campo</th>
                  <th className="border p-2 text-left text-foreground">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-mono">numero_processo_anvisa</td><td className="border p-2">Número do processo no sistema ANVISA</td></tr>
                <tr><td className="border p-2 font-mono">tipo_produto_anvisa</td><td className="border p-2">Grau 1 (notificação) ou Grau 2 (registro)</td></tr>
                <tr><td className="border p-2 font-mono">data_envio_anvisa</td><td className="border p-2">Data de protocolo do dossiê</td></tr>
                <tr><td className="border p-2 font-mono">data_aprovacao_anvisa</td><td className="border p-2">Data de aprovação/publicação no DOU</td></tr>
                <tr><td className="border p-2 font-mono">taxa_anvisa</td><td className="border p-2">Valor da taxa de fiscalização sanitária</td></tr>
                <tr><td className="border p-2 font-mono">observacoes_regulatorio</td><td className="border p-2">Exigências técnicas, pendências, comentários</td></tr>
                <tr><td className="border p-2 font-mono">anvisa_status</td><td className="border p-2">Status atual no pipeline (enum de 5 valores)</td></tr>
              </tbody>
            </table>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-destructive/60 mt-4">
              <strong>Regra de Negócio:</strong> Produtos Grau 2 exigem registro completo na ANVISA antes de avançar 
              para o estágio "Cadastro Final". Produtos Grau 1 necessitam apenas de notificação.
            </div>
          </div>
        </section>

        {/* 11. CADASTRO FINAL */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            11. Cadastro Final — Validações Obrigatórias
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground">
              A transição para o estágio <strong>"Cadastro Final"</strong> exige a validação de completude em 7 itens 
              regulatórios e fiscais obrigatórios. O sistema bloqueia a transição se algum item estiver incompleto.
            </p>

            <h3 className="font-bold">11.1 Checklist de Validação (7 Itens)</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">#</th>
                  <th className="border p-2 text-left text-foreground">Validação</th>
                  <th className="border p-2 text-left text-foreground">Campo Verificado</th>
                  <th className="border p-2 text-center text-foreground">Bloqueante</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["1", "ANVISA aprovado ou notificado", "anvisa_status", "✅"],
                  ["2", "NCM preenchido", "ncm", "✅"],
                  ["3", "CEST preenchido (se aplicável)", "cest", "⚠️"],
                  ["4", "EAN unitário válido", "ean_unidade", "✅"],
                  ["5", "Peso líquido informado", "peso_liquido_g", "✅"],
                  ["6", "Validade em meses definida", "validade_meses", "✅"],
                  ["7", "Arte final aprovada", "checklist.arte_final", "✅"],
                ].map(([num, validacao, campo, bloq]) => (
                  <tr key={num} className="border-b">
                    <td className="border p-2 font-mono font-bold text-foreground">{num}</td>
                    <td className="border p-2">{validacao}</td>
                    <td className="border p-2 font-mono">{campo}</td>
                    <td className="border p-2 text-center">{bloq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 12. APROVAÇÃO FÍSICA E RNC */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            12. Aprovação Física e RNC (Registro de Não Conformidade)
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <h3 className="font-bold">12.1 Critérios de Aprovação Física</h3>
            <table className="w-full border-collapse mt-2">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Critério</th>
                  <th className="border p-2 text-left text-foreground">O que é avaliado</th>
                  <th className="border p-2 text-left text-foreground">Resultado</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr><td className="border p-2 font-medium text-foreground">Cor</td><td className="border p-2">Correspondência com padrão aprovado</td><td className="border p-2">Conforme / Não Conforme</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Textura</td><td className="border p-2">Consistência e aplicação dentro do padrão</td><td className="border p-2">Conforme / Não Conforme</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Fragrância</td><td className="border p-2">Perfil olfativo conforme aprovação</td><td className="border p-2">Conforme / Não Conforme</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Rotulagem</td><td className="border p-2">Informações legais, idioma, composição</td><td className="border p-2">Conforme / Não Conforme</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Peso</td><td className="border p-2">Peso líquido dentro da tolerância (±5%)</td><td className="border p-2">Conforme / Não Conforme</td></tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">12.2 Fluxo de Não Conformidade (RNC)</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌──────────────────────────────────────────────────────────────────────────────┐
│                 FLUXO DE NÃO CONFORMIDADE (RNC)                            │
│                                                                              │
│  ┌────────────┐    ┌────────────┐    ┌───────────────────┐                  │
│  │ Avaliação  │    │   GERA     │    │    NOTIFICA       │                  │
│  │ Negativa   │───▶│   RNC      │───▶│   FORNECEDOR      │                  │
│  │ (critério) │    │ (registro) │    │   (automático)    │                  │
│  └────────────┘    └────────────┘    └─────────┬─────────┘                  │
│                                                │                            │
│                                                ▼                            │
│                                       ┌───────────────────┐                 │
│                                       │  AÇÃO CORRETIVA   │                 │
│                                       │  (fornecedor resp.)│                 │
│                                       └─────────┬─────────┘                 │
│                                                 │                           │
│                                      ┌──────────┴──────────┐                │
│                                      │                     │                │
│                                      ▼                     ▼                │
│                               ┌────────────┐       ┌────────────┐           │
│                               │ ✅ RESOLVIDA│       │ ❌ ESCALADA │           │
│                               │ (aprovação) │       │ (diretoria)│           │
│                               └────────────┘       └────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘`}</pre>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary mt-4">
              <strong>Rastreabilidade:</strong> Cada RNC registra critério afetado, descrição da não conformidade, 
              fotos de evidência, ação corretiva proposta, responsável e prazo. O histórico completo é mantido na tabela <code>produto_rnc</code>.
            </div>
          </div>
        </section>

        {/* 13. TABELAS DE DADOS (SCHEMA) */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            13. Schema de Dados — Tabelas e Relacionamentos
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <pre className="bg-muted p-4 rounded-lg text-xs leading-relaxed overflow-x-auto font-mono text-foreground">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA DO MÓDULO DE DESENVOLVIMENTO                         │
│                                                                                 │
│  ┌──────────────┐         ┌──────────────────────┐                              │
│  │   projetos   │────────▶│   produtos_brasil    │◀──── china_produto_submissoes│
│  │              │  1:N    │                      │       (dados de origem)      │
│  └──────────────┘         └──────────┬───────────┘                              │
│                                      │                                          │
│                      ┌───────────────┼───────────────────────┐                  │
│                      │               │                       │                  │
│                      ▼               ▼                       ▼                  │
│           ┌──────────────┐ ┌───────────────────┐ ┌─────────────────────┐        │
│           │produto_testes│ │produtos_brasil_   │ │ produtos_brasil_   │        │
│           │              │ │checklist          │ │ custos             │        │
│           │ • tipo_teste │ │ • item_nome       │ │ • custo_fob        │        │
│           │ • resultado  │ │ • status          │ │ • custo_cif        │        │
│           │ • avaliador  │ │ • arquivo_url     │ │ • markup           │        │
│           │ • data_teste │ │ • aprovado_por    │ │ • preco_sugerido   │        │
│           └──────────────┘ └───────────────────┘ └─────────────────────┘        │
│                                                                                 │
│                      ┌───────────────┬───────────────────────┐                  │
│                      │               │                       │                  │
│                      ▼               ▼                       ▼                  │
│           ┌──────────────┐ ┌───────────────────┐ ┌─────────────────────┐        │
│           │produtos_     │ │produto_aprovacoes │ │ produto_imagens    │        │
│           │brasil_skus   │ │_fisicas           │ │                     │        │
│           │              │ │                   │ │ • etapa            │        │
│           │ • cor_nome   │ │ • criterio        │ │ • foto_url         │        │
│           │ • ean        │ │ • resultado       │ │ • ordem            │        │
│           │ • quantidade │ │ • avaliador       │ │                     │        │
│           └──────────────┘ └────────┬──────────┘ └─────────────────────┘        │
│                                     │                                           │
│                                     ▼                                           │
│                            ┌───────────────┐                                    │
│                            │  produto_rnc  │                                    │
│                            │               │                                    │
│                            │ • criterio    │                                    │
│                            │ • descricao   │                                    │
│                            │ • acao_corr.  │                                    │
│                            │ • status      │                                    │
│                            └───────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* 14. CONTROLE DE ACESSO */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            14. Controle de Acesso por Fase
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
                <tr><td className="border p-2 font-medium text-foreground">Gestor de Produto</td><td className="border p-2">Ideia → Lançamento</td><td className="border p-2">Criar, editar, vincular projetos, definir prioridades</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Equipe Regulatória</td><td className="border p-2">Regulatório, Cadastro Final</td><td className="border p-2">Preencher dossiê ANVISA, validar checklist regulatório</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Design</td><td className="border p-2">Desenvolvimento, Embalagem</td><td className="border p-2">Upload de artes, mockups, fotos de catálogo</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">QA (Qualidade)</td><td className="border p-2">Testes, Aprovação</td><td className="border p-2">Registrar testes, aprovar/reprovar critérios físicos, gerar RNC</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Admin / Cofre</td><td className="border p-2">Todas</td><td className="border p-2">Acesso total, gerenciar documentos no cofre, configurar templates</td></tr>
                <tr><td className="border p-2 font-medium text-foreground">Diretoria</td><td className="border p-2">Aprovação, Lançamento</td><td className="border p-2">Aprovação final, revisão de fichas de custo, decisão Go/No-Go</td></tr>
              </tbody>
            </table>

            <div className="bg-muted/50 p-3 rounded border-l-4 border-primary mt-4">
              <strong>Restrições de Segurança:</strong>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Módulo de Projetos acessível apenas para usuários com permissão de módulo <code>projetos</code></li>
                <li>Template "Desenvolvimento" restrito a admins e gestores de produto</li>
                <li>Cofre de documentos com controle de acesso por projeto</li>
                <li>Transições de estágio validadas por RLS no backend</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 15. INTEGRAÇÕES */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            15. Integrações do Módulo
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">Integração</th>
                  <th className="border p-2 text-left text-foreground">Descrição</th>
                  <th className="border p-2 text-center text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="border p-2 font-medium text-foreground">China → Brasil (Onboarding)</td>
                  <td className="border p-2">Importação automática de dados da submissão China para o cadastro Brasil. Herda nome, código, categoria, descrição, fotos e grade de cores.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Cofre de Documentos</td>
                  <td className="border p-2">Versionamento de arquivos por projeto com controle de acesso. Suporta artes, laudos, dossiês e documentos regulatórios.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Briefing IA</td>
                  <td className="border p-2">Geração automática de briefing técnico por inteligência artificial com base nos dados do produto e tendências de mercado.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Image Timeline</td>
                  <td className="border p-2">Linha do tempo visual de imagens em 5 etapas: China Source → Análise → Desenvolvimento → Aprovado → Marketing.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Ficha de Custo</td>
                  <td className="border p-2">Cálculo automatizado de custo importado (FOB, frete, impostos, markup) com simulação de preço de venda.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Grade/SKUs</td>
                  <td className="border p-2">Tabela de SKUs com cores, quantidades, EAN e drag-and-drop. Suporta kit/display por composição de itens.</td>
                  <td className="border p-2 text-center">✅ Ativo</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-bold mt-4">15.1 Image Timeline — 5 Etapas</h3>
            <pre className="bg-muted p-3 rounded text-xs font-mono mt-2 text-foreground">{`
  ┌─────────────┐    ┌─────────────┐    ┌───────────────┐    ┌─────────────┐    ┌─────────────┐
  │ 🇨🇳 CHINA   │    │ 🔍 ANÁLISE  │    │ 🔧 DESENV.   │    │ ✅ APROVADO │    │ 📸 MARKETING│
  │   SOURCE    │───▶│             │───▶│               │───▶│             │───▶│             │
  │             │    │  Avaliação  │    │  Protótipos   │    │  Amostra    │    │  Foto final │
  │  Foto fábr. │    │  interna    │    │  e testes     │    │  aprovada   │    │  catálogo   │
  └─────────────┘    └─────────────┘    └───────────────┘    └─────────────┘    └─────────────┘`}</pre>
          </div>
        </section>

        {/* 16. MÉTRICAS E INDICADORES */}
        <section className="page-break">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            16. Métricas e Indicadores (KPIs)
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-4">
            <p className="text-muted-foreground">
              O sistema permite extrair indicadores-chave de desempenho do processo de desenvolvimento, 
              baseados nos dados registrados ao longo do pipeline.
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left text-foreground">KPI</th>
                  <th className="border p-2 text-left text-foreground">Fórmula / Fonte</th>
                  <th className="border p-2 text-left text-foreground">Meta Sugerida</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="border p-2 font-medium text-foreground">Tempo Médio por Estágio</td>
                  <td className="border p-2">Diferença entre timestamps de transição de status</td>
                  <td className="border p-2">{"< 15 dias por estágio"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Lead Time Total (Ideia → Lançamento)</td>
                  <td className="border p-2">Data de criação → data do status "lancamento"</td>
                  <td className="border p-2">{"< 120 dias"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Taxa de Aprovação de Testes</td>
                  <td className="border p-2">Testes aprovados / total de testes × 100</td>
                  <td className="border p-2">{"> 80%"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">RNCs Abertas</td>
                  <td className="border p-2">Count de RNCs com status ≠ "resolvida"</td>
                  <td className="border p-2">{"< 5 simultâneas"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Produtos por Fase</td>
                  <td className="border p-2">Distribuição de produtos por status no pipeline</td>
                  <td className="border p-2">Balanceado (sem gargalos)</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Tempo Médio ANVISA</td>
                  <td className="border p-2">data_envio_anvisa → data_aprovacao_anvisa</td>
                  <td className="border p-2">{"< 60 dias (Grau 1), < 180 dias (Grau 2)"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium text-foreground">Completude de Checklist</td>
                  <td className="border p-2">Itens aprovados / 12 itens total × 100</td>
                  <td className="border p-2">100% antes do Cadastro Final</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 17. CONCLUSÃO */}
        <section className="page-break border-t-4 border-primary pt-6 mt-8">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">
            17. Conclusão
          </h2>
          <div className="mt-4 text-sm text-foreground space-y-3">
            <p className="text-muted-foreground leading-relaxed">
              O sistema BiMaster/Huggs implementa um <strong>PLM (Product Lifecycle Management) completo</strong> para 
              a gestão do ciclo de vida de produtos cosméticos, abrangendo desde a concepção até o lançamento comercial.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Com <strong>12 estágios obrigatórios</strong>, validação de pré-requisitos entre etapas, 6 módulos integrados 
              (testes, embalagem, regulatório, aprovação, custos e grade), e governança por papéis, o sistema garante:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><strong>Rastreabilidade total</strong> — Cada decisão, teste e aprovação é registrado com timestamp e responsável</li>
              <li><strong>Conformidade regulatória</strong> — Pipeline ANVISA integrado com bloqueio de transição para produtos sem aprovação</li>
              <li><strong>Qualidade assegurada</strong> — 5 critérios de aprovação física + sistema de RNC com ação corretiva</li>
              <li><strong>Eficiência operacional</strong> — Wizard de criação, herança de dados China, briefing por IA</li>
              <li><strong>Visibilidade executiva</strong> — KPIs de tempo, taxa de aprovação e distribuição por fase</li>
            </ul>
            <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="font-bold text-foreground">Sistema BiMaster / Huggs PLM</p>
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

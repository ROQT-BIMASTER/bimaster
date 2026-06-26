import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSwitch } from "@/components/navigation/v2/SidebarSwitch";
import { AppHeaderBar } from "@/components/dashboard/AppHeaderBar";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Users, FolderOpen, Send, Shield, MessageSquare, CheckCircle2, XCircle, UserCheck, UserPlus, Lock, HelpCircle } from "lucide-react";

function YesNo({ yes, label }: { yes: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {yes ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-rose-600" />
      )}
      <span className="text-xs">{label}</span>
    </span>
  );
}

export default function VisibilidadeProjetos() {
  const navigate = useNavigate();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarSwitch />
        <main className="flex-1 overflow-auto">
          <AppHeaderBar />
          <div className="p-6 space-y-6 max-w-5xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}
            className="-ml-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>

          <header className="space-y-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" /> Visibilidade de Projetos
            </h1>
            <p className="text-muted-foreground text-sm">
              Entenda exatamente quem vê quais tarefas na Central de Trabalho e dentro dos projetos,
              com exemplos práticos e respostas para as dúvidas mais comuns.
            </p>
          </header>


          {/* Matriz resumo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Matriz resumo</CardTitle>
              <CardDescription className="text-xs">
                Como cada papel enxerga as tarefas em cada superfície do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Papel</th>
                      <th className="p-2">Central</th>
                      <th className="p-2">Projeto (lista)</th>
                      <th className="p-2">Histórico</th>
                    </tr>
                  </thead>
                  <tbody className="text-center">
                    <tr className="border-b"><td className="text-left p-2">Responsável</td><td>sim</td><td>sim</td><td>sim</td></tr>
                    <tr className="border-b"><td className="text-left p-2">Colaborador</td><td>sim</td><td>sim</td><td>sim</td></tr>
                    <tr className="border-b"><td className="text-left p-2">Criador (apenas)</td><td>aba Delegadas</td><td>não</td><td>sim</td></tr>
                    <tr className="border-b"><td className="text-left p-2">Coordenador</td><td>somente suas*</td><td>tudo</td><td>tudo</td></tr>
                    <tr className="border-b"><td className="text-left p-2">Membro do projeto</td><td>somente suas*</td><td>somente suas</td><td>somente suas</td></tr>
                    <tr><td className="text-left p-2">Admin</td><td>somente suas*</td><td>tudo</td><td>tudo</td></tr>
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2">
                  * a Central sempre considera somente as tarefas em que a pessoa é responsável ou colaborador,
                  independentemente de outros papéis.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Exemplos práticos */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Exemplos práticos</h2>

            {/* Exemplo 1: Responsável */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Exemplo 1 — Responsável direto
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">caso típico</Badge>
                </div>
                <CardDescription className="text-xs">
                  Maria é responsável pela tarefa "Aprovar arte da embalagem".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <div><strong>Tarefa:</strong> Aprovar arte da embalagem</div>
                  <div><strong>Responsável:</strong> Maria</div>
                  <div><strong>Colaboradores:</strong> —</div>
                  <div><strong>Criador:</strong> João</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">O que Maria vê</div>
                    <YesNo yes label="Tarefa aparece na Central (aba Tarefas)" />
                    <YesNo yes label="Tarefa aparece no projeto" />
                    <YesNo yes label="Recebe notificações de mudanças" />
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">O que João (criador) vê</div>
                    <YesNo yes={false} label="NÃO aparece na aba Tarefas" />
                    <YesNo yes label="Aparece na aba Delegadas" />
                    <YesNo yes label="Vê o histórico de acesso da tarefa" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exemplo 2: Colaborador */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    Exemplo 2 — Colaborador adicionado
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">apoio explícito</Badge>
                </div>
                <CardDescription className="text-xs">
                  Carlos é adicionado como colaborador para apoiar Maria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <div><strong>Tarefa:</strong> Aprovar arte da embalagem</div>
                  <div><strong>Responsável:</strong> Maria</div>
                  <div><strong>Colaboradores:</strong> Carlos</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">O que Carlos vê</div>
                    <YesNo yes label="Tarefa aparece na Central" />
                    <YesNo yes label="Pode comentar e anexar arquivos" />
                    <YesNo yes={false} label="NÃO pode reatribuir o responsável" />
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">Quando Carlos é removido</div>
                    <YesNo yes label="Evento 'perdeu_acesso' fica no histórico" />
                    <YesNo yes={false} label="Tarefa some da Central de Carlos" />
                    <YesNo yes label="Maria continua como responsável" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exemplo 3: Liberação por seção */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Exemplo 3 — Liberação por seção
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">acesso de navegação</Badge>
                </div>
                <CardDescription className="text-xs">
                  Ana recebe acesso à seção "Regulatório" do projeto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <div><strong>Seção liberada:</strong> Regulatório</div>
                  <div><strong>Tarefas na seção:</strong> 8</div>
                  <div><strong>Tarefas em que Ana é responsável/colaborador:</strong> 2</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">Dentro do projeto</div>
                    <YesNo yes label="Ana vê a seção Regulatório listada" />
                    <YesNo yes label="Ana vê as 2 tarefas dela" />
                    <YesNo yes={false} label="NÃO vê as outras 6 tarefas da seção" />
                    <YesNo yes label="Aparece banner de 'Visão parcial'" />
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-1">
                    <div className="font-medium">Na Central de Trabalho</div>
                    <YesNo yes={false} label="Liberação de seção NÃO traz tarefas" />
                    <YesNo yes label="Apenas as 2 tarefas atribuídas aparecem" />
                    <YesNo yes label="Para ver mais, precisa virar responsável ou colaborador" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* FAQ */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> Perguntas frequentes
            </h2>

            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="papeis">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Quem é responsável, colaborador, criador, coordenador?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p><strong>Responsável:</strong> a pessoa diretamente designada para executar a tarefa. Existe apenas um por tarefa.</p>
                  <p><strong>Colaborador:</strong> alguém adicionado explicitamente para acompanhar ou apoiar a tarefa.</p>
                  <p><strong>Criador:</strong> quem registrou a tarefa no sistema. Pode ou não ser o responsável.</p>
                  <p><strong>Coordenador:</strong> membro do projeto com privilégios de gestão; vê todas as tarefas do projeto.</p>
                  <p><strong>Administrador:</strong> usuário com perfil global de admin; vê tudo em qualquer projeto.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="central">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> O que aparece na minha Central de Trabalho?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>A Central mostra <strong>somente</strong> tarefas em que você é:</p>
                  <ul className="list-disc ml-5">
                    <li>Responsável direto, ou</li>
                    <li>Colaborador adicionado explicitamente</li>
                  </ul>
                  <p>Tarefas que você apenas criou (e delegou a outra pessoa) aparecem na aba <strong>Delegadas</strong>.</p>
                  <p>Ser membro de um projeto, ter uma seção liberada, ou ser coordenador <strong>não traz tarefas</strong> para a Central.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="projeto">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> O que aparece dentro de um projeto?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Coordenadores, criadores do projeto e administradores veem <strong>todas</strong> as tarefas e seções.</p>
                  <p>Demais membros veem apenas tarefas em que são responsável ou colaborador. Aparece um banner de "Visão parcial" quando algumas tarefas ficam ocultas.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="secao">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> O que muda com liberação de seção?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Liberar uma seção dá ao usuário <strong>permissão de navegação</strong> dentro daquela seção, mas <strong>não traz</strong> automaticamente todas as tarefas dela. Para alguém ver uma tarefa, ela precisa estar atribuída como responsável ou colaborador.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="delegadas">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Aba "Delegadas por mim"</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Lista as tarefas que <strong>você criou</strong> e <strong>delegou</strong> para outras pessoas, sem ser responsável nem colaborador. Útil para acompanhar pendências de quem trabalha com você.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="acesso">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Como pedir acesso a uma tarefa?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Solicite ao responsável atual ou ao coordenador do projeto que te adicione como <strong>colaborador</strong> da tarefa, ou que te transfira a responsabilidade. Toda mudança fica registrada no histórico de acesso da tarefa.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sumiu">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Por que uma tarefa sumiu da minha Central?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>As causas mais comuns são:</p>
                  <ul className="list-disc ml-5">
                    <li>O responsável foi alterado para outra pessoa.</li>
                    <li>Você foi removido da lista de colaboradores.</li>
                    <li>A tarefa foi concluída ou cancelada (e o filtro atual oculta esses estados).</li>
                  </ul>
                  <p>Abra o histórico de acesso da tarefa para ver exatamente o evento que tirou seu acesso e quem fez a alteração.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="visao-parcial">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> O que significa o banner "Visão parcial"?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Indica que o projeto tem mais tarefas ou seções do que você está vendo. Você está enxergando apenas o subconjunto autorizado pelas regras de visibilidade. O banner mostra quantas tarefas e seções estão ocultas.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="debug">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Como administradores investigam visibilidade?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Administradores têm acesso a duas ferramentas:</p>
                  <ul className="list-disc ml-5">
                    <li>Botão <strong>"Por que vejo isto?"</strong> dentro do detalhe de qualquer tarefa, que exibe as regras aplicadas para um usuário específico.</li>
                    <li>Página dedicada em <code className="text-xs bg-muted px-1 py-0.5 rounded">/dashboard/projetos/admin/visibilidade</code> para auditoria em lote.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="auditoria">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> O sistema registra mudanças de acesso?</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Sim. Cada mudança de responsável, adição ou remoção de colaborador, e liberação ou revogação de seção gera um evento no <strong>histórico de acesso</strong> da tarefa, com data, autor da mudança e motivo. Esse log é visível dentro do detalhe da tarefa.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

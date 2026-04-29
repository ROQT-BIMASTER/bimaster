import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Users, FolderOpen, Send, Shield, MessageSquare } from "lucide-react";

export default function VisibilidadeProjetos() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" /> Visibilidade de Projetos
            </h1>
            <p className="text-muted-foreground text-sm">
              Entenda exatamente quem vê quais tarefas na Central de Trabalho e dentro dos projetos.
            </p>
          </header>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Matriz resumo</h2>
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
                <p className="text-xs text-muted-foreground mt-2">* a Central sempre considera somente as tarefas em que a pessoa é responsável ou colaborador, independentemente de outros papéis.</p>
              </div>
            </CardContent>
          </Card>

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
          </Accordion>
        </main>
      </div>
    </SidebarProvider>
  );
}

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 05 de março de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar o sistema Union CRM ("Sistema"), você concorda com estes Termos de Uso. 
              O acesso é concedido exclusivamente por administradores autorizados e está condicionado à 
              aceitação integral destes termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p>
              O Sistema é uma plataforma de gestão empresarial que inclui módulos de CRM, financeiro, 
              trade marketing, gestão de projetos e demais ferramentas operacionais. O acesso aos módulos 
              é controlado por permissões atribuídas individualmente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Responsabilidades do Usuário</h2>
            <p>O usuário se compromete a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Não compartilhar login e senha com terceiros</li>
              <li>Utilizar o Sistema exclusivamente para fins profissionais autorizados</li>
              <li>Não tentar acessar módulos, dados ou funcionalidades não autorizados</li>
              <li>Reportar imediatamente qualquer uso não autorizado ou violação de segurança</li>
              <li>Manter atualizados seus dados cadastrais</li>
              <li>Não exportar, copiar ou distribuir dados do Sistema sem autorização</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Controle de Acesso</h2>
            <p>
              O acesso ao Sistema segue o princípio do menor privilégio. Cada usuário recebe permissões 
              específicas de acordo com sua função e departamento. Atividades como exportação de dados, 
              alterações de permissões e acessos a informações sensíveis são registradas em logs de auditoria.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo do Sistema, incluindo código-fonte, design, marcas e funcionalidades, é de 
              propriedade exclusiva da Union CRM. É vedada a reprodução, distribuição ou modificação sem 
              autorização prévia por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Disponibilidade do Serviço</h2>
            <p>
              Nos esforçamos para manter o Sistema disponível 24/7, mas não garantimos disponibilidade 
              ininterrupta. Manutenções programadas e eventos de força maior podem causar interrupções 
              temporárias, que serão comunicadas com antecedência quando possível.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Suspensão e Bloqueio</h2>
            <p>O acesso pode ser suspenso ou bloqueado nas seguintes situações:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violação destes Termos de Uso</li>
              <li>Tentativa de acesso não autorizado a dados ou módulos</li>
              <li>Inatividade prolongada da conta</li>
              <li>Desligamento do colaborador</li>
              <li>Determinação da administração por motivos de segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Proteção de Dados</h2>
            <p>
              O tratamento de dados pessoais segue as diretrizes da LGPD (Lei nº 13.709/2018). 
              Consulte nossa{" "}
              <a href="/politica-privacidade" className="text-primary underline hover:text-primary/80">
                Política de Privacidade
              </a>{" "}
              para informações detalhadas sobre coleta, uso e proteção de dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Limitação de Responsabilidade</h2>
            <p>
              A Union CRM não se responsabiliza por danos decorrentes de uso indevido do Sistema, 
              perda de dados causada por ações do usuário, ou indisponibilidade causada por fatores 
              externos fora de nosso controle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Alterações nos Termos</h2>
            <p>
              Estes termos podem ser atualizados a qualquer momento. As alterações serão comunicadas 
              por meio do Sistema e entrarão em vigor na data de publicação. O uso continuado do 
              Sistema após a publicação constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Foro</h2>
            <p>
              Para dirimir quaisquer controvérsias decorrentes destes Termos, fica eleito o foro da 
              comarca da sede da empresa, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Uso podem ser enviadas para: <strong>contato@union.com.br</strong>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default TermosDeUso;

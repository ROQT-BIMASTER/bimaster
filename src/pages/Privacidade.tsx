import { useEffect } from "react";

const Privacidade = () => {
  useEffect(() => {
    document.title = "Política de Privacidade | Bimaster";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Política de Privacidade da plataforma Bimaster: tratamento de dados pessoais conforme LGPD.");
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 01 de maio de 2026</p>

        <section className="space-y-6 text-sm leading-relaxed">
          <p>
            Esta Política de Privacidade descreve como a plataforma Bimaster ("nós", "nossa") coleta,
            utiliza, armazena e protege os dados pessoais dos usuários ("você") em conformidade com a
            Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
          </p>

          <div>
            <h2 className="text-xl font-semibold mb-2">1. Dados coletados</h2>
            <p>
              Coletamos apenas os dados necessários para a operação da plataforma: nome, e-mail
              corporativo, identificadores funcionais (cargo, área), dados de acesso (logs de
              autenticação) e informações de uso da aplicação. Não coletamos dados sensíveis sem
              consentimento expresso.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">2. Finalidade do tratamento</h2>
            <p>
              Os dados são utilizados exclusivamente para autenticação, controle de acesso, auditoria
              de operações, suporte ao usuário e cumprimento de obrigações legais e contratuais.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">3. Compartilhamento</h2>
            <p>
              Não compartilhamos seus dados pessoais com terceiros para fins comerciais. O
              compartilhamento ocorre apenas com prestadores de serviço de infraestrutura
              (hospedagem, e-mail transacional) sob contratos de confidencialidade, ou por exigência
              legal.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">4. Segurança</h2>
            <p>
              Aplicamos controles técnicos e organizacionais: criptografia em trânsito (HTTPS/TLS),
              autenticação obrigatória, controle de acesso baseado em função (RBAC), políticas de
              isolamento por linha (RLS) no banco de dados, registro de auditoria e revisão
              periódica de permissões.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">5. Direitos do titular</h2>
            <p>
              Você pode, a qualquer momento, solicitar acesso, correção, portabilidade, anonimização,
              bloqueio ou eliminação dos seus dados pessoais, bem como informações sobre o
              tratamento, através do canal de contato indicado abaixo.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">6. Retenção</h2>
            <p>
              Os dados são mantidos pelo tempo necessário ao cumprimento das finalidades para as
              quais foram coletados, observados os prazos legais de guarda.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">7. Contato do Encarregado (DPO)</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:{" "}
              <a href="mailto:contato@bimaster.online" className="text-primary underline">
                contato@bimaster.online
              </a>
              .
            </p>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t text-xs text-muted-foreground">
          <a href="/" className="underline mr-4">Início</a>
          <a href="/termos" className="underline mr-4">Termos de Uso</a>
          <a href="/contato" className="underline">Contato</a>
        </footer>
      </div>
    </main>
  );
};

export default Privacidade;

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 05 de março de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introdução</h2>
            <p>
              A Union CRM ("nós", "nosso") está comprometida com a proteção dos dados pessoais de seus usuários, 
              em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD). 
              Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Dados Pessoais Coletados</h2>
            <p>Coletamos os seguintes tipos de dados pessoais:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dados de identificação:</strong> nome completo, e-mail corporativo, CPF (quando aplicável)</li>
              <li><strong>Dados de acesso:</strong> credenciais de autenticação, endereço IP, user-agent do navegador</li>
              <li><strong>Dados de uso:</strong> registros de navegação no sistema, páginas acessadas, ações realizadas</li>
              <li><strong>Dados profissionais:</strong> departamento, cargo, hierarquia organizacional</li>
              <li><strong>Dados de clientes e parceiros:</strong> informações comerciais gerenciadas dentro do sistema (CNPJ, endereço, contato)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Finalidades do Tratamento</h2>
            <p>Os dados são tratados para as seguintes finalidades:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Autenticação e controle de acesso ao sistema</li>
              <li>Gestão de relacionamento com clientes (CRM)</li>
              <li>Controle financeiro e operacional</li>
              <li>Auditoria e conformidade regulatória</li>
              <li>Geração de relatórios e análises gerenciais</li>
              <li>Segurança da informação e prevenção a fraudes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Base Legal</h2>
            <p>O tratamento de dados pessoais é realizado com base nas seguintes hipóteses legais da LGPD (Art. 7º):</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Execução de contrato:</strong> para prestação dos serviços contratados</li>
              <li><strong>Legítimo interesse:</strong> para segurança, auditoria e melhoria do sistema</li>
              <li><strong>Cumprimento de obrigação legal:</strong> para atender exigências fiscais e regulatórias</li>
              <li><strong>Consentimento:</strong> quando aplicável, para finalidades específicas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Compartilhamento de Dados</h2>
            <p>
              Os dados pessoais não são compartilhados com terceiros, exceto quando necessário para:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cumprimento de obrigação legal ou regulatória</li>
              <li>Prestação de serviços essenciais por fornecedores homologados (sob contrato de proteção de dados)</li>
              <li>Proteção dos direitos e segurança da empresa e seus colaboradores</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Segurança dos Dados</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger os dados pessoais:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Criptografia em trânsito (TLS/HTTPS) e em repouso</li>
              <li>Controle de acesso baseado em roles (RBAC) com Row Level Security</li>
              <li>Mascaramento de dados sensíveis (PII) em visualizações restritas</li>
              <li>Logs de auditoria para rastreabilidade de acessos e operações</li>
              <li>Política de senhas fortes (mínimo 12 caracteres, complexidade obrigatória)</li>
              <li>Logout automático por inatividade</li>
              <li>Monitoramento contínuo de segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Retenção de Dados</h2>
            <p>
              Os dados pessoais são mantidos pelo período necessário para cumprir as finalidades descritas nesta política, 
              ou conforme exigido por lei. Logs de auditoria são arquivados após 90 dias e retidos por até 5 anos 
              para fins de conformidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Direitos do Titular</h2>
            <p>Conforme a LGPD (Art. 18), você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Solicitar correção de dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Solicitar portabilidade dos dados</li>
              <li>Revogar consentimento, quando aplicável</li>
              <li>Obter informações sobre compartilhamento de dados</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato pelo e-mail: <strong>privacidade@union.com.br</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Encarregado de Dados (DPO)</h2>
            <p>
              O Encarregado de Proteção de Dados pode ser contatado em: <strong>dpo@union.com.br</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Alterações nesta Política</h2>
            <p>
              Esta política pode ser atualizada periodicamente. As alterações serão comunicadas por meio do sistema 
              e entrarão em vigor na data de publicação.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default PoliticaPrivacidade;

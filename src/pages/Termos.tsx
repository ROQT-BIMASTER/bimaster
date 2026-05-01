import { useEffect } from "react";

const Termos = () => {
  useEffect(() => {
    document.title = "Termos de Uso | Bimaster";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Termos de Uso da plataforma Bimaster — sistema de gestão integrada de negócios.");
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 01 de maio de 2026</p>

        <section className="space-y-6 text-sm leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Objeto</h2>
            <p>
              A plataforma Bimaster é um sistema de gestão integrada de negócios (ERP, financeiro,
              gestão de projetos, marketing e operações industriais) destinado exclusivamente a
              usuários corporativos previamente autorizados.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">2. Acesso</h2>
            <p>
              O acesso é restrito a usuários cadastrados e aprovados. É proibido compartilhar
              credenciais, tentar contornar mecanismos de autenticação ou acessar áreas sem
              autorização.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">3. Uso aceitável</h2>
            <p>
              É vedado: (i) utilizar a plataforma para fins ilícitos; (ii) inserir dados falsos,
              difamatórios ou que violem direitos de terceiros; (iii) realizar engenharia reversa,
              testes de intrusão não autorizados ou tentativas de obter acesso indevido a dados;
              (iv) introduzir códigos maliciosos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">4. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo da plataforma — código, marca, layout e documentação — é protegido por
              direitos de propriedade intelectual. É vedada qualquer reprodução sem autorização
              expressa.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">5. Limitação de responsabilidade</h2>
            <p>
              A plataforma é fornecida "como está". Empenhamo-nos em manter alta disponibilidade,
              porém não garantimos operação ininterrupta ou ausência de erros. Não nos
              responsabilizamos por danos indiretos decorrentes do uso.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">6. Encerramento</h2>
            <p>
              O acesso pode ser suspenso ou encerrado, a qualquer tempo, em caso de violação destes
              termos ou por solicitação do usuário/empresa contratante.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">7. Foro</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil, sendo eleito o
              foro da comarca da sede da contratante para dirimir quaisquer controvérsias.
            </p>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t text-xs text-muted-foreground">
          <a href="/" className="underline mr-4">Início</a>
          <a href="/privacidade" className="underline mr-4">Privacidade</a>
          <a href="/contato" className="underline">Contato</a>
        </footer>
      </div>
    </main>
  );
};

export default Termos;

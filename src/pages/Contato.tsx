import { useEffect } from "react";

const Contato = () => {
  useEffect(() => {
    document.title = "Contato | Bimaster";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Canais oficiais de contato da plataforma Bimaster — suporte, segurança e privacidade.");
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-8">Contato</h1>

        <section className="space-y-6 text-sm leading-relaxed">
          <p>
            A plataforma <strong>Bimaster</strong> é um sistema corporativo de gestão integrada de
            negócios. Para falar conosco, utilize os canais oficiais abaixo.
          </p>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Suporte e atendimento</h2>
              <p>
                <a href="mailto:contato@bimaster.online" className="text-primary underline">
                  contato@bimaster.online
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-1">Privacidade e LGPD</h2>
              <p>
                <a href="mailto:contato@bimaster.online" className="text-primary underline">
                  contato@bimaster.online
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-1">Segurança da informação</h2>
              <p>
                Para reportar vulnerabilidades, consulte nosso{" "}
                <a href="/.well-known/security.txt" className="text-primary underline">
                  security.txt
                </a>
                .
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Atendimento em dias úteis, horário comercial (BRT/UTC-3).
          </p>
        </section>

        <footer className="mt-12 pt-6 border-t text-xs text-muted-foreground">
          <a href="/" className="underline mr-4">Início</a>
          <a href="/privacidade" className="underline mr-4">Privacidade</a>
          <a href="/termos" className="underline">Termos de Uso</a>
        </footer>
      </div>
    </main>
  );
};

export default Contato;

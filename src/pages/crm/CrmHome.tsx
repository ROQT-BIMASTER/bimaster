import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Inbox, Users, Ticket, BarChart3, Settings } from "lucide-react";

const sections = [
  { to: "/dashboard/crm/bots", icon: Bot, title: "Bots & Canais", desc: "Cadastre chaves dos fluxos Blip e canais conectados." },
  { to: "/dashboard/crm/inbox", icon: Inbox, title: "Inbox unificada", desc: "Conversas em tempo real (em construção)." },
  { to: "/dashboard/crm/contatos", icon: Users, title: "Contatos 360", desc: "Ficha completa, histórico cross-canal." },
  { to: "/dashboard/crm/tickets", icon: Ticket, title: "Tickets & SLA", desc: "Ciclo de vida, prioridade, vínculos." },
  { to: "/dashboard/crm/analytics", icon: BarChart3, title: "Analytics & BI", desc: "Dashboards, heatmap, exportações." },
  { to: "/dashboard/crm/configuracoes", icon: Settings, title: "Configurações", desc: "Filas, SLA, integrações, flags." },
];

export default function CrmHome() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM & Atendimento</h1>
        <p className="text-muted-foreground">
          Plataforma omnichannel — fase 1 em modo leitura sobre os bots Blip existentes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} className="block group">
            <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

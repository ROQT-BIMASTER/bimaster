import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, Warehouse, ArrowUpDown, Truck, ShoppingCart } from "lucide-react";

const items = [
  {
    to: "/dashboard/fornecedor/vendas",
    title: "Análise de Vendas",
    desc: "KPIs, ranking e detalhamento das notas faturadas",
    icon: BarChart3,
    accent: "border-l-pink-500",
    iconBg: "bg-pink-100 dark:bg-pink-900/40",
    iconColor: "text-pink-600 dark:text-pink-400",
  },
  {
    to: "/dashboard/fornecedor/estoque",
    title: "Estoque do Fornecedor",
    desc: "Posição integrada, cobertura e curva ABC",
    icon: Warehouse,
    accent: "border-l-indigo-500",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    to: "/dashboard/fornecedor/pedidos",
    title: "Pedidos em andamento",
    desc: "Kanban e tabela dos pedidos de venda com tempo em cada etapa",
    icon: ShoppingCart,
    accent: "border-l-cyan-500",
    iconBg: "bg-cyan-100 dark:bg-cyan-900/40",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    to: "/dashboard/fornecedor/depara-ean",
    title: "De-Para EAN",
    desc: "Mapeamento de EAN do fornecedor ao catálogo master",
    icon: ArrowUpDown,
    accent: "border-l-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

export default function FornecedorModule() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-900/40">
            <Truck className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Fornecedor</h1>
            <p className="text-muted-foreground mt-1">
              Vendas e estoque sob a ótica do fornecedor
            </p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}>
                <Card className={`group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 ${item.accent} h-full`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className={`p-2.5 rounded-xl ${item.iconBg}`}>
                        <Icon className={`h-6 w-6 ${item.iconColor}`} />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

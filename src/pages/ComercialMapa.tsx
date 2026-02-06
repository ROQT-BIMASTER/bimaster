import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CommercialMap } from "@/components/comercial/mapa/CommercialMap";
import { MapPin } from "lucide-react";

const ComercialMapa = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-7 w-7 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">Mapa Comercial</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Centro de comando territorial — visualize sua carteira de clientes e oportunidades
          </p>
        </div>

        <CommercialMap />
      </div>
    </DashboardLayout>
  );
};

export default ComercialMapa;

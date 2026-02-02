import { X, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Badge } from "@/components/ui/badge";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUser, impersonatedPermissions, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">Admin</Badge>;
      case "supervisor":
        return <Badge className="bg-purple-500 hover:bg-purple-600">Supervisor</Badge>;
      case "vendedor":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Vendedor</Badge>;
      case "promotor":
        return <Badge className="bg-green-500 hover:bg-green-600">Promotor</Badge>;
      default:
        return <Badge variant="secondary">{role || "Sem role"}</Badge>;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 animate-pulse" />
          <span className="font-medium">
            Visualizando como:
          </span>
          <span className="font-bold">{impersonatedUser.nome}</span>
          <span className="text-amber-100 text-sm">({impersonatedUser.email})</span>
          {getRoleBadge(impersonatedUser.role)}
          
          <span className="text-amber-100 text-sm ml-4">
            • {impersonatedPermissions?.modules.length || 0} módulos
            • {impersonatedPermissions?.screens.length || 0} telas
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-amber-100 text-sm mr-2">
            <Shield className="h-4 w-4" />
            <span>Modo Visualização</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={stopImpersonation}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <X className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

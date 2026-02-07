import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export const SignupForm = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Acesso Restrito
        </CardTitle>
        <CardDescription>
          O cadastro público está desabilitado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Novas contas são criadas exclusivamente por administradores do sistema.
            Entre em contato com o administrador se precisar de acesso.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/auth/login")}
            className="w-full"
          >
            Voltar para Login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

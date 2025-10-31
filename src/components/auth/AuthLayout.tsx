import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">CRM Sistema</h1>
          <p className="text-muted-foreground">Gestão de Prospects e Vendas</p>
        </header>
        {children}
      </div>
    </main>
  );
};

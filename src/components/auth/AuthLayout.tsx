import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("auth.system_title")}</h1>
          <p className="text-muted-foreground">{t("auth.system_subtitle")}</p>
        </header>
        {children}
      </div>
      <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground space-x-3">
        <Link to="/politica-privacidade" className="hover:text-foreground underline underline-offset-2">
          Política de Privacidade
        </Link>
        <span>•</span>
        <Link to="/termos-de-uso" className="hover:text-foreground underline underline-offset-2">
          Termos de Uso
        </Link>
      </footer>
    </main>
  );
};

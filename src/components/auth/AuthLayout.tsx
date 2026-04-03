import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import logoHuugs from "@/assets/logo-huugs.jpg";

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.06),transparent_50%)]" />
      <div className="w-full max-w-md flex-1 flex flex-col justify-center relative z-10">
        <header className="text-center mb-8">
          <img
            src={logoHuugs}
            alt="Huugs MakeUp"
            className="mx-auto h-16 w-auto mb-4 rounded-lg shadow-sm"
          />
          <h1 className="text-3xl font-bold text-foreground mb-1">{t("auth.system_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.system_subtitle")}</p>
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

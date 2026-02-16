import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("auth.system_title")}</h1>
          <p className="text-muted-foreground">{t("auth.system_subtitle")}</p>
        </header>
        {children}
      </div>
    </main>
  );
};

import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import logoHuugs from "@/assets/logo-huugs.jpg";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <Link
        to="/"
        aria-label="Início"
        className="absolute left-3 top-3 sm:left-4 sm:top-4 z-10"
      >
        <img
          src={logoHuugs}
          alt="Huugs MakeUp"
          data-testid="app-logo"
          className="h-7 sm:h-8 md:h-9 w-auto max-w-[120px] sm:max-w-[140px] object-contain"
        />
      </Link>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="text-primary underline hover:opacity-80">
          Voltar para o Início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

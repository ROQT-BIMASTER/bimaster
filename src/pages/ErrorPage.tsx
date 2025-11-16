import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log do erro
  logger.error(
    'Router error occurred',
    error instanceof Error ? error : new Error('Unknown router error'),
    {
      component: 'ErrorPage',
      metadata: { error },
    }
  );

  let errorMessage = 'Ocorreu um erro inesperado.';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {errorStatus === 404 ? 'Página Não Encontrada' : 'Erro ' + errorStatus}
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorStatus === 404 ? (
            <p className="text-center text-muted-foreground">
              A página que você está procurando não existe ou foi movida.
            </p>
          ) : (
            <p className="text-center text-muted-foreground">
              Ocorreu um problema ao processar sua solicitação. Por favor, tente novamente.
            </p>
          )}

          {/* Mostrar stack trace apenas em desenvolvimento */}
          {import.meta.env.DEV && error instanceof Error && (
            <div className="rounded-lg bg-muted p-4 text-sm font-mono overflow-auto max-h-48">
              <p className="text-destructive font-semibold mb-2">
                {error.name}: {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={() => navigate('/')} variant="default">
              <Home className="mr-2 h-4 w-4" />
              Ir para Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

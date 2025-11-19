import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Pegar erro do state da navegação (se houver)
  const error = location.state?.error;
  const errorStatus = location.state?.status || 404;

  let errorMessage = 'Página não encontrada';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
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
          <p className="text-center text-muted-foreground">
            {errorStatus === 404 
              ? 'A página que você está procurando não existe ou foi movida.'
              : 'Ocorreu um problema. Por favor, tente novamente.'}
          </p>

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

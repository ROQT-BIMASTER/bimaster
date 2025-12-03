import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import logoUnion from '@/assets/logo-union.png';

interface SplashScreenProps {
  progress: number;
  status: string;
  onComplete?: () => void;
}

export function SplashScreen({ progress, status, onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (progress >= 100) {
      // Aguardar um pouco antes de iniciar fade out
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 500);

      // Remover completamente após animação
      const removeTimer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 1000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [progress, onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8 max-w-md w-full">
        {/* Logo com animação de pulse */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <img 
            src={logoUnion} 
            alt="BiMaster" 
            className="h-24 w-auto relative z-10 drop-shadow-lg"
          />
        </div>
        
        {/* Título */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          BiMaster
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Trade Marketing & CRM
        </p>
        
        {/* Progress bar */}
        <div className="w-full space-y-3">
          <Progress 
            value={progress} 
            className="h-2 bg-muted"
          />
          
          {/* Status e percentual */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate mr-4">{status}</span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* Indicador de loading */}
        {progress < 100 && (
          <div className="mt-8 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        {/* Mensagem de sucesso */}
        {progress >= 100 && (
          <div className="mt-8 text-center animate-fade-in">
            <p className="text-sm text-primary font-medium">
              ✓ Pronto!
            </p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-8 text-xs text-muted-foreground">
        <p>Versão 2.0</p>
      </div>
    </div>
  );
}

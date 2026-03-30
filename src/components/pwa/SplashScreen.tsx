import { useEffect, useState, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import logoHuugs from '@/assets/logo-huugs.jpg';

interface SplashScreenProps {
  progress: number;
  status: string;
  onComplete?: () => void;
}

export function SplashScreen({ progress, status, onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (progress >= 100 && !fadeOut) {
      setFadeOut(true);
      
      // Chamar onComplete após animação mais curta
      const timer = setTimeout(() => {
        setShouldRender(false);
        onComplete?.();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [progress, fadeOut, onComplete]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8 max-w-md w-full">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <img 
            src={logoHuugs} 
            alt="Huugs MakeUp" 
            className="h-24 w-auto relative z-10 drop-shadow-lg"
          />
        </div>
        
        {/* Título */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Sistema de Gestão Huugs
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Gestão Integrada de Negócios
        </p>
        
        {/* Progress bar */}
        <div className="w-full space-y-3">
          <Progress value={progress} className="h-2 bg-muted" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate mr-4">{status}</span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* Loading dots */}
        {progress < 100 && (
          <div className="mt-8 flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
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

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Ban, TrendingDown, RefreshCw, Eye, Clock, CheckCircle2,
  Trash2, Edit, Check, X, Calendar, User, Building2
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RevisaoGastosCardProps {
  revisao: any;
  onUpdateStatus: (id: string, status: string, resultadoObtido?: number) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: Ban },
};

const tipoConfig = {
  eliminar: { label: 'Eliminar', color: 'text-red-500 bg-red-50 dark:bg-red-900/20', icon: Ban },
  reduzir: { label: 'Reduzir', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20', icon: TrendingDown },
  renegociar: { label: 'Renegociar', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', icon: RefreshCw },
  monitorar: { label: 'Monitorar', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', icon: Eye },
};

const prioridadeConfig = {
  alta: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
};

export function RevisaoGastosCard({ revisao, onUpdateStatus, onDelete, compact = false }: RevisaoGastosCardProps) {
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [resultadoObtido, setResultadoObtido] = useState(revisao.resultado_obtido?.toString() || '');

  const tipo = tipoConfig[revisao.tipo_revisao as keyof typeof tipoConfig] || tipoConfig.monitorar;
  const status = statusConfig[revisao.status as keyof typeof statusConfig] || statusConfig.pendente;
  const prioridade = prioridadeConfig[revisao.prioridade as keyof typeof prioridadeConfig] || prioridadeConfig.media;
  const TipoIcon = tipo.icon;
  const StatusIcon = status.icon;

  const nome = revisao.plano_contas?.name || revisao.categoria_nome || 'Item não identificado';
  const departamento = revisao.departamento?.nome;
  const responsavel = revisao.responsavel?.nome || revisao.responsavel?.email;
  
  const diasRestantes = revisao.prazo_revisao 
    ? differenceInDays(new Date(revisao.prazo_revisao), new Date())
    : null;

  const handleConcluir = () => {
    if (resultadoObtido) {
      onUpdateStatus(revisao.id, 'concluido', parseFloat(resultadoObtido));
      setIsEditingResult(false);
    }
  };

  if (compact) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: tipo.color.includes('red') ? '#ef4444' : tipo.color.includes('orange') ? '#f97316' : tipo.color.includes('blue') ? '#3b82f6' : '#a855f7' }}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <TipoIcon className={`h-4 w-4 flex-shrink-0 ${tipo.color.split(' ')[0]}`} />
              <div className="min-w-0">
                <p className="font-medium truncate text-sm">{nome}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {departamento && <span>{departamento}</span>}
                  {responsavel && <span>• {responsavel}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono font-semibold text-sm">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.valor_atual || 0)}
              </span>
              <Badge className={status.color} variant="secondary">
                {status.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: tipo.color.includes('red') ? '#ef4444' : tipo.color.includes('orange') ? '#f97316' : tipo.color.includes('blue') ? '#3b82f6' : '#a855f7' }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Lado esquerdo - Info principal */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${tipo.color}`}>
                <TipoIcon className="h-3.5 w-3.5" />
                {tipo.label}
              </div>
              <Badge className={prioridade.color} variant="secondary">
                <span className={`w-1.5 h-1.5 rounded-full ${prioridade.dot} mr-1.5`} />
                {prioridade.label}
              </Badge>
              <Badge className={status.color} variant="secondary">
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold text-base">{nome}</h4>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {departamento && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {departamento}
                  </span>
                )}
                {responsavel && (
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {responsavel}
                  </span>
                )}
                {revisao.prazo_revisao && (
                  <span className={`flex items-center gap-1 ${diasRestantes !== null && diasRestantes < 0 ? 'text-red-500' : diasRestantes !== null && diasRestantes <= 7 ? 'text-yellow-600' : ''}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {format(parseISO(revisao.prazo_revisao), "dd/MM/yyyy", { locale: ptBR })}
                    {diasRestantes !== null && (
                      <span className="text-xs">
                        ({diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atrás` : diasRestantes === 0 ? 'hoje' : `${diasRestantes}d`})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {revisao.observacoes && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                {revisao.observacoes}
              </p>
            )}
          </div>

          {/* Lado direito - Valores e ações */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Atual</p>
              <p className="font-mono font-bold text-lg">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.valor_atual || 0)}
              </p>
            </div>

            {(revisao.meta_reducao_valor || revisao.meta_reducao_percentual) && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meta de Redução</p>
                <p className="font-mono text-sm text-orange-600">
                  {revisao.meta_reducao_percentual && `${revisao.meta_reducao_percentual}%`}
                  {revisao.meta_reducao_percentual && revisao.meta_reducao_valor && ' / '}
                  {revisao.meta_reducao_valor && new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.meta_reducao_valor)}
                </p>
              </div>
            )}

            {revisao.status === 'concluido' && revisao.resultado_obtido && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Economia Obtida</p>
                <p className="font-mono text-sm text-green-600 font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.resultado_obtido)}
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-1 mt-2">
              {revisao.status === 'pendente' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onUpdateStatus(revisao.id, 'em_andamento')}
                >
                  Iniciar
                </Button>
              )}

              {revisao.status === 'em_andamento' && (
                <>
                  {isEditingResult ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Valor economizado"
                        value={resultadoObtido}
                        onChange={(e) => setResultadoObtido(e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleConcluir}>
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingResult(false)}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setIsEditingResult(true)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                  )}
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Edit className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {revisao.status !== 'pendente' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'pendente')}>
                      <Clock className="h-4 w-4 mr-2" />
                      Marcar como Pendente
                    </DropdownMenuItem>
                  )}
                  {revisao.status !== 'em_andamento' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'em_andamento')}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Em Andamento
                    </DropdownMenuItem>
                  )}
                  {revisao.status !== 'cancelado' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(revisao.id, 'cancelado')}>
                      <Ban className="h-4 w-4 mr-2" />
                      Cancelar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-red-500 hover:text-red-600"
                onClick={() => onDelete(revisao.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

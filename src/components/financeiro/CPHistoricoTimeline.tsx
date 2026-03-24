import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, UserCircle, FilePen, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  contaId: string;
}

const CAMPO_LABELS: Record<string, string> = {
  fornecedor_nome: "Fornecedor",
  fornecedor_codigo: "Cód. Fornecedor",
  valor_original: "Valor Original",
  valor_aberto: "Valor Aberto",
  valor_pago: "Valor Pago",
  data_vencimento: "Vencimento",
  data_emissao: "Emissão",
  data_competencia: "Competência",
  data_pagamento: "Data Pagamento",
  status: "Status",
  categoria_nome: "Categoria",
  portador: "Portador",
  tipo_documento: "Tipo Documento",
  numero_documento: "Nº Documento",
  empresa_id: "Empresa",
  departamento_nome: "Departamento",
  plano_contas_codigo: "Plano Contas",
  plano_contas_nome: "Nome Plano Contas",
  chave_nfe: "Chave NF-e",
  numero_documento_fiscal: "Nº Doc. Fiscal",
  codigo_projeto: "Projeto",
  total_parcelas: "Total Parcelas",
  data_previsao: "Data Previsão",
  id_conta_corrente: "Conta Corrente",
};

function formatValue(val: string | null): string {
  if (val === null || val === undefined || val === "" || val === "null") return "(vazio)";
  // Try to format dates
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return format(new Date(val), "dd/MM/yyyy", { locale: ptBR });
    } catch { /* fall through */ }
  }
  // Try to format currency values
  if (/^\d+\.?\d*$/.test(val) && parseFloat(val) > 0) {
    const num = parseFloat(val);
    if (num > 1) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
    }
  }
  return val;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aberto: "Aberto",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
  parcialmente_pago: "Parcial",
};

export function CPHistoricoTimeline({ contaId }: Props) {
  const { data: historico, isLoading } = useQuery({
    queryKey: ["cp-historico", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar_historico" as any)
        .select("*")
        .eq("conta_id", contaId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!contaId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map-cp-hist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      return (data || []).reduce((map: Record<string, string>, p: any) => {
        map[p.id] = p.full_name || p.email || p.id;
        return map;
      }, {});
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  if (!historico?.length) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Nenhum registro de histórico encontrado.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-3">
      <div className="space-y-3">
        {historico.map((item: any, index: number) => {
          const userName = item.usuario_id && profiles?.[item.usuario_id]
            ? profiles[item.usuario_id]
            : item.usuario_nome || "Sistema";

          const isInsert = item.tipo_alteracao === "INSERT";
          const campo = item.campo_alterado;
          const label = CAMPO_LABELS[campo] || campo;

          const valorAnterior = campo === "status"
            ? STATUS_LABELS[item.valor_anterior] || item.valor_anterior
            : formatValue(item.valor_anterior);
          const valorNovo = campo === "status"
            ? STATUS_LABELS[item.valor_novo] || item.valor_novo
            : formatValue(item.valor_novo);

          return (
            <div key={item.id}>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {isInsert ? (
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-1">
                      <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-1">
                      <FilePen className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isInsert ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {isInsert ? "Cadastro" : "Alteração"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                    <UserCircle className="h-3 w-3" />
                    <span>{userName}</span>
                  </div>

                  {!isInsert && (
                    <div className="mt-1 text-xs bg-muted/50 rounded px-2 py-1">
                      <span className="font-medium">{label}:</span>{" "}
                      <span className="text-destructive line-through">{valorAnterior}</span>
                      {" → "}
                      <span className="text-green-600 dark:text-green-400 font-medium">{valorNovo}</span>
                    </div>
                  )}

                  {isInsert && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Título cadastrado no sistema
                    </p>
                  )}

                  {item.justificativa && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                      Justificativa: {item.justificativa}
                    </p>
                  )}
                </div>
              </div>
              {index < historico.length - 1 && <Separator className="mt-3" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

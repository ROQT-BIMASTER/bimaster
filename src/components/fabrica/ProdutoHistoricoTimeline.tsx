import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, UserCircle, FilePen, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  produtoId: string;
}

const CAMPO_LABELS: Record<string, string> = {
  nome: "Nome",
  nome_comercial: "Nome Comercial",
  codigo: "Código",
  sku: "SKU",
  codigo_barras_ean: "EAN/GTIN",
  codigo_legado: "Código Legado",
  descricao: "Descrição",
  descricao_curta: "Descrição Curta",
  descricao_completa: "Descrição Completa",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  linha: "Linha",
  marca: "Marca",
  fabricante: "Fabricante",
  modelo: "Modelo",
  versao_variacao: "Versão/Variação",
  ncm: "NCM",
  status: "Status",
  ativo: "Ativo",
  tipo: "Tipo",
  origem: "Origem",
  foto_url: "Foto",
  formula_id: "Fórmula",
  unidade_medida_id: "Unidade de Medida",
  tempo_producao_minutos: "Tempo Produção",
  rendimento: "Rendimento",
  tipo_rotulagem: "Tipo Rotulagem",
  preco_maximo: "Preço Máximo",
  preco_minimo: "Preço Mínimo",
  custo_unitario: "Custo Unitário",
  modo_foco: "Modo Foco",
  itens_display: "Itens Display",
  updated_by: "Atualizado por",
  created_by: "Criado por",
};

const IGNORED_FIELDS = ["updated_at", "updated_by", "created_at"];

function formatValue(val: any): string {
  if (val === null || val === undefined || val === "") return "(vazio)";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  return String(val);
}

export function ProdutoHistoricoTimeline({ produtoId }: Props) {
  const { data: historico, isLoading } = useQuery({
    queryKey: ["fabrica-produto-historico", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos_historico" as any)
        .select("*")
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!produtoId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map-historico"],
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
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  if (!historico?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum registro de histórico encontrado.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {historico.map((item: any, index: number) => {
          const userName = item.usuario_id && profiles?.[item.usuario_id]
            ? profiles[item.usuario_id]
            : "Sistema";

          const isInsert = item.acao === "INSERT";

          // Filter meaningful changes
          const changes = item.campos_alterados
            ? Object.entries(item.campos_alterados as Record<string, any>).filter(
                ([key]) => !IGNORED_FIELDS.includes(key)
              )
            : [];

          return (
            <div key={item.id}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isInsert ? (
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-1.5">
                      <Plus className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-1.5">
                      <FilePen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isInsert ? "default" : "secondary"} className="text-xs">
                      {isInsert ? "Cadastro" : "Alteração"}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <UserCircle className="h-3.5 w-3.5" />
                    <span>{userName}</span>
                  </div>

                  {!isInsert && changes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {changes.map(([campo, vals]: [string, any]) => (
                        <div key={campo} className="text-xs bg-muted/50 rounded px-2 py-1">
                          <span className="font-medium">{CAMPO_LABELS[campo] || campo}:</span>{" "}
                          <span className="text-destructive line-through">
                            {formatValue(vals.antes)}
                          </span>
                          {" → "}
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatValue(vals.depois)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isInsert && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Produto cadastrado no sistema
                    </p>
                  )}
                </div>
              </div>
              {index < historico.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

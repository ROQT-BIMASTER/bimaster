import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Calendar, Activity, TrendingUp, Loader2, RefreshCw, Pencil, Save, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface LeadResumoIAProps {
  prospect: {
    id: string;
    nome_empresa: string;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    cnpj: string | null;
    porte_empresa: string | null;
    status: string;
    categoria: string | null;
    ultimo_contato: string | null;
    proxima_acao: string | null;
    observacoes: string | null;
  };
  onUpdate?: () => void;
}

export const LeadResumoIA = ({ prospect, onUpdate }: LeadResumoIAProps) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [activityCount, setActivityCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    contato_principal: prospect.contato_principal || "",
    email: prospect.email || "",
    telefone: prospect.telefone || "",
    cnpj: prospect.cnpj || "",
    porte_empresa: prospect.porte_empresa || "",
    categoria: prospect.categoria || "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchActivityCount();
  }, [prospect.id]);

  const fetchActivityCount = async () => {
    const { count } = await supabase
      .from("atividades")
      .select("*", { count: "exact", head: true })
      .eq("prospect_id", prospect.id);
    setActivityCount(count || 0);
  };

  const generateInsight = async () => {
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-insight", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      setInsight(data?.insight || "Não foi possível gerar o insight.");
    } catch (err) {
      console.error("Erro ao gerar insight:", err);
      setInsight("Erro ao gerar insight. Tente novamente.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const diasSemContato = prospect.ultimo_contato
    ? differenceInDays(new Date(), new Date(prospect.ultimo_contato))
    : null;

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      novo: "Novo", em_contato: "Em Contato", proposta_enviada: "Proposta Enviada",
      negociacao: "Negociação", ganho: "Ganho", perdido: "Perdido",
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{diasSemContato !== null ? diasSemContato : "—"}</p>
            <p className="text-xs text-muted-foreground">Dias sem contato</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{activityCount}</p>
            <p className="text-xs text-muted-foreground">Atividades registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <Badge variant="outline" className="text-lg px-3 py-1">
              {prospect.categoria || "—"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Categoria</p>
          </CardContent>
        </Card>
      </div>

      {/* Dados de Qualificação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dados de Qualificação</CardTitle>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button size="sm" onClick={async () => {
                setSaving(true);
                const { error } = await supabase.from("prospects").update({
                  contato_principal: editData.contato_principal || null,
                  email: editData.email || null,
                  telefone: editData.telefone || null,
                  cnpj: editData.cnpj || null,
                  porte_empresa: editData.porte_empresa || null,
                  categoria: (editData.categoria || null) as "A" | "B" | "C" | "D" | null,
                }).eq("id", prospect.id);
                setSaving(false);
                if (error) {
                  toast({ title: "Erro ao salvar", variant: "destructive" });
                } else {
                  toast({ title: "Dados atualizados" });
                  setEditing(false);
                  onUpdate?.();
                }
              }} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Empresa:</span>
              <p className="font-medium">{prospect.nome_empresa}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium">{getStatusLabel(prospect.status)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CNPJ:</span>
              {editing ? (
                <Input value={editData.cnpj} onChange={e => setEditData({...editData, cnpj: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.cnpj || "—"}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Porte:</span>
              {editing ? (
                <Input value={editData.porte_empresa} onChange={e => setEditData({...editData, porte_empresa: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.porte_empresa || "—"}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Contato:</span>
              {editing ? (
                <Input value={editData.contato_principal} onChange={e => setEditData({...editData, contato_principal: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.contato_principal || "—"}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              {editing ? (
                <Input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.email || "—"}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Telefone:</span>
              {editing ? (
                <Input value={editData.telefone} onChange={e => setEditData({...editData, telefone: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.telefone || "—"}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Categoria:</span>
              {editing ? (
                <Input value={editData.categoria} onChange={e => setEditData({...editData, categoria: e.target.value})} className="h-8 mt-1" />
              ) : (
                <p className="font-medium">{prospect.categoria || "—"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insight da IA */}
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Insight da IA
          </CardTitle>
          <Button size="sm" variant="outline" onClick={generateInsight} disabled={loadingInsight}>
            {loadingInsight ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{insight ? "Atualizar" : "Gerar"}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {insight ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{insight}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Clique em "Gerar" para obter um resumo inteligente do momento deste lead.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

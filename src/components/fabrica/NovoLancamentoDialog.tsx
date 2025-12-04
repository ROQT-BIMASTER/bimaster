import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Users, Megaphone, Loader2 } from "lucide-react";

type Lancamento = {
  id: string;
  nome_lancamento: string;
  descricao: string | null;
  data_prevista: string;
  data_efetiva: string | null;
  status: string;
  tipo: string;
  prioridade: string;
  produto_id: string | null;
  tabela_preco_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  onSuccess: () => void;
};

const tarefasMarketingPresets = [
  { tipo: "post_social", titulo: "Post Instagram/Facebook" },
  { tipo: "stories", titulo: "Stories/Reels" },
  { tipo: "catalogo", titulo: "Catálogo PDF" },
  { tipo: "ficha_tecnica", titulo: "Ficha Técnica" },
  { tipo: "email_marketing", titulo: "Email Marketing" },
  { tipo: "banner", titulo: "Banner Site" },
  { tipo: "video", titulo: "Vídeo Produto" },
];

export default function NovoLancamentoDialog({ open, onOpenChange, lancamento, onSuccess }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!lancamento;

  const [formData, setFormData] = useState({
    nome_lancamento: "",
    descricao: "",
    data_prevista: "",
    tipo: "novo_produto",
    prioridade: "media",
    produto_id: "",
    tabela_preco_id: "",
    responsavel_id: "",
    observacoes: "",
  });

  const [selectedDistribuidoras, setSelectedDistribuidoras] = useState<string[]>([]);
  const [selectedTarefas, setSelectedTarefas] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("produto");

  // Fetch products
  const { data: produtos } = useQuery({
    queryKey: ["fabrica-produtos-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, nome, codigo")
        .eq("ativo", true)
        .in("tipo", ["ACABADO", "INTER"])
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch price tables
  const { data: tabelas } = useQuery({
    queryKey: ["fabrica-tabelas-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome, codigo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch users
  const { data: usuarios } = useQuery({
    queryKey: ["profiles-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("aprovado", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch distributors
  const { data: distribuidoras } = useQuery({
    queryKey: ["distribuidoras-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_distribuidoras")
        .select("id, nome, cidade, uf")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (lancamento) {
      setFormData({
        nome_lancamento: lancamento.nome_lancamento,
        descricao: lancamento.descricao || "",
        data_prevista: lancamento.data_prevista,
        tipo: lancamento.tipo,
        prioridade: lancamento.prioridade,
        produto_id: lancamento.produto_id || "",
        tabela_preco_id: lancamento.tabela_preco_id || "",
        responsavel_id: lancamento.responsavel_id || "",
        observacoes: lancamento.observacoes || "",
      });
    } else {
      setFormData({
        nome_lancamento: "",
        descricao: "",
        data_prevista: "",
        tipo: "novo_produto",
        prioridade: "media",
        produto_id: "",
        tabela_preco_id: "",
        responsavel_id: "",
        observacoes: "",
      });
      setSelectedDistribuidoras([]);
      setSelectedTarefas([]);
    }
  }, [lancamento, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        produto_id: formData.produto_id || null,
        tabela_preco_id: formData.tabela_preco_id || null,
        responsavel_id: formData.responsavel_id || null,
        created_by: user?.id,
      };

      let lancamentoId: string;

      if (isEditing && lancamento) {
        const { error } = await supabase
          .from("lancamentos_produtos")
          .update(payload)
          .eq("id", lancamento.id);
        if (error) throw error;
        lancamentoId = lancamento.id;
      } else {
        const { data, error } = await supabase
          .from("lancamentos_produtos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        lancamentoId = data.id;

        // Insert distribuidoras
        if (selectedDistribuidoras.length > 0) {
          const distInserts = selectedDistribuidoras.map((distId) => ({
            lancamento_id: lancamentoId,
            distribuidora_id: distId,
            data_comunicacao: formData.data_prevista,
          }));
          await supabase.from("lancamentos_distribuidores").insert(distInserts);
        }

        // Insert marketing tasks
        if (selectedTarefas.length > 0) {
          const tarefasInserts = selectedTarefas.map((tipo) => {
            const preset = tarefasMarketingPresets.find((p) => p.tipo === tipo);
            return {
              lancamento_id: lancamentoId,
              titulo: preset?.titulo || tipo,
              tipo,
              data_prazo: formData.data_prevista,
            };
          });
          await supabase.from("lancamentos_tarefas_marketing").insert(tarefasInserts);
        }
      }

      return lancamentoId;
    },
    onSuccess: () => {
      toast.success(isEditing ? "Lançamento atualizado!" : "Lançamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["lancamentos-produtos"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_lancamento || !formData.data_prevista) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    saveMutation.mutate();
  };

  const toggleDistribuidora = (id: string) => {
    setSelectedDistribuidoras((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleTarefa = (tipo: string) => {
    setSelectedTarefas((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Lançamento" : "Novo Lançamento de Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="produto" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produto
              </TabsTrigger>
              <TabsTrigger value="distribuidores" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Distribuidores
              </TabsTrigger>
              <TabsTrigger value="marketing" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Marketing
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              {/* Produto Tab */}
              <TabsContent value="produto" className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="nome_lancamento">Nome do Lançamento *</Label>
                    <Input
                      id="nome_lancamento"
                      value={formData.nome_lancamento}
                      onChange={(e) => setFormData({ ...formData, nome_lancamento: e.target.value })}
                      placeholder="Ex: Lançamento Coleção Verão 2025"
                    />
                  </div>

                  <div>
                    <Label htmlFor="produto_id">Produto</Label>
                    <Select
                      value={formData.produto_id}
                      onValueChange={(v) => setFormData({ ...formData, produto_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo} - {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tabela_preco_id">Tabela de Preço</Label>
                    <Select
                      value={formData.tabela_preco_id}
                      onValueChange={(v) => setFormData({ ...formData, tabela_preco_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a tabela" />
                      </SelectTrigger>
                      <SelectContent>
                        {tabelas?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.codigo} - {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="data_prevista">Data Prevista *</Label>
                    <Input
                      id="data_prevista"
                      type="date"
                      value={formData.data_prevista}
                      onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tipo">Tipo de Lançamento</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo_produto">Novo Produto</SelectItem>
                        <SelectItem value="reformulacao">Reformulação</SelectItem>
                        <SelectItem value="nova_versao">Nova Versão</SelectItem>
                        <SelectItem value="promocional">Promocional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="prioridade">Prioridade</Label>
                    <Select
                      value={formData.prioridade}
                      onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="responsavel_id">Responsável</Label>
                    <Select
                      value={formData.responsavel_id}
                      onValueChange={(v) => setFormData({ ...formData, responsavel_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="descricao">Descrição / Briefing</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descreva o lançamento, público-alvo, diferenciais..."
                      rows={3}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={2}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Distribuidores Tab */}
              <TabsContent value="distribuidores" className="space-y-4 pr-4">
                <p className="text-sm text-muted-foreground">
                  Selecione as distribuidoras que receberão comunicação sobre este lançamento:
                </p>
                <div className="space-y-2">
                  {distribuidoras?.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`dist-${d.id}`}
                        checked={selectedDistribuidoras.includes(d.id)}
                        onCheckedChange={() => toggleDistribuidora(d.id)}
                      />
                      <label htmlFor={`dist-${d.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{d.nome}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {d.cidade}/{d.uf}
                        </span>
                      </label>
                    </div>
                  ))}
                  {(!distribuidoras || distribuidoras.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhuma distribuidora cadastrada
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Marketing Tab */}
              <TabsContent value="marketing" className="space-y-4 pr-4">
                <p className="text-sm text-muted-foreground">
                  Selecione os conteúdos que serão criados automaticamente como tarefas para o Marketing:
                </p>
                <div className="space-y-2">
                  {tarefasMarketingPresets.map((t) => (
                    <div
                      key={t.tipo}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`tarefa-${t.tipo}`}
                        checked={selectedTarefas.includes(t.tipo)}
                        onCheckedChange={() => toggleTarefa(t.tipo)}
                      />
                      <label htmlFor={`tarefa-${t.tipo}`} className="flex-1 cursor-pointer">
                        {t.titulo}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedTarefas.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    {selectedTarefas.length} tarefa(s) serão criadas automaticamente com prazo para{" "}
                    {formData.data_prevista || "a data prevista do lançamento"}.
                  </p>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Lançamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

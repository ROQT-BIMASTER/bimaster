import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface RegraFiscal {
  id: string;
  ncm_codigo: string;
  ncm_descricao: string;
  uf_origem: string;
  uf_destino: string;
  cst_icms_entrada: string | null;
  aliquota_icms: number | null;
  tem_st: boolean;
  cfop_entrada: string | null;
  ativo: boolean;
}

export function CadastroRegrasFiscaisNCM() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [regras, setRegras] = useState<RegraFiscal[]>([]);
  const [ncms, setNcms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ncm_id: "",
    uf_origem: "",
    uf_destino: "",
    cst_icms_entrada: "",
    cst_icms_saida: "",
    aliquota_icms: "",
    aliquota_fcp: "",
    tem_st: false,
    mva: "",
    reducao_base_icms: "",
    cfop_entrada: "",
    cfop_saida: "",
    cst_ipi: "",
    aliquota_ipi: "",
    cst_pis: "",
    cst_cofins: "",
    aliquota_pis: "",
    aliquota_cofins: "",
    comentario: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      carregarNCMs();
      carregarRegras();
    }
  }, [open]);

  const carregarNCMs = async () => {
    try {
      const { data, error } = await supabase
        .from("fabrica_ncm")
        .select("id, codigo, descricao")
        .eq("ativo", true)
        .order("codigo");

      if (error) throw error;
      setNcms(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar NCMs:", error);
    }
  };

  const carregarRegras = async () => {
    try {
      const { data, error } = await supabase
        .from("fabrica_regras_fiscais_ncm")
        .select(`
          *,
          fabrica_ncm!inner(codigo, descricao)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const regrasFormatadas = (data || []).map((r: any) => ({
        id: r.id,
        ncm_codigo: r.fabrica_ncm.codigo,
        ncm_descricao: r.fabrica_ncm.descricao,
        uf_origem: r.uf_origem,
        uf_destino: r.uf_destino,
        cst_icms_entrada: r.cst_icms_entrada,
        aliquota_icms: r.aliquota_icms,
        tem_st: r.tem_st,
        cfop_entrada: r.cfop_entrada,
        ativo: r.ativo,
      }));

      setRegras(regrasFormatadas);
    } catch (error: any) {
      console.error("Erro ao carregar regras:", error);
      toast.error("Erro ao carregar regras fiscais");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        ncm_id: formData.ncm_id,
        uf_origem: formData.uf_origem,
        uf_destino: formData.uf_destino,
        cst_icms_entrada: formData.cst_icms_entrada || null,
        cst_icms_saida: formData.cst_icms_saida || null,
        aliquota_icms: formData.aliquota_icms ? parseFloat(formData.aliquota_icms) : null,
        aliquota_fcp: formData.aliquota_fcp ? parseFloat(formData.aliquota_fcp) : null,
        tem_st: formData.tem_st,
        mva: formData.mva ? parseFloat(formData.mva) : null,
        reducao_base_icms: formData.reducao_base_icms ? parseFloat(formData.reducao_base_icms) : null,
        cfop_entrada: formData.cfop_entrada || null,
        cfop_saida: formData.cfop_saida || null,
        cst_ipi: formData.cst_ipi || null,
        aliquota_ipi: formData.aliquota_ipi ? parseFloat(formData.aliquota_ipi) : null,
        cst_pis: formData.cst_pis || null,
        cst_cofins: formData.cst_cofins || null,
        aliquota_pis: formData.aliquota_pis ? parseFloat(formData.aliquota_pis) : null,
        aliquota_cofins: formData.aliquota_cofins ? parseFloat(formData.aliquota_cofins) : null,
        comentario: formData.comentario || null,
        ativo: formData.ativo,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("fabrica_regras_fiscais_ncm")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Regra atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("fabrica_regras_fiscais_ncm")
          .insert([payload]);

        if (error) throw error;
        toast.success("Regra cadastrada com sucesso!");
      }

      setEditOpen(false);
      setEditingId(null);
      resetForm();
      carregarRegras();
    } catch (error: any) {
      console.error("Erro ao salvar regra:", error);
      toast.error(error.message || "Erro ao salvar regra fiscal");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (regraId: string) => {
    try {
      const { data, error } = await supabase
        .from("fabrica_regras_fiscais_ncm")
        .select("*")
        .eq("id", regraId)
        .single();

      if (error) throw error;

      setEditingId(regraId);
      setFormData({
        ncm_id: data.ncm_id,
        uf_origem: data.uf_origem,
        uf_destino: data.uf_destino,
        cst_icms_entrada: data.cst_icms_entrada || "",
        cst_icms_saida: data.cst_icms_saida || "",
        aliquota_icms: data.aliquota_icms?.toString() || "",
        aliquota_fcp: data.aliquota_fcp?.toString() || "",
        tem_st: data.tem_st || false,
        mva: data.mva?.toString() || "",
        reducao_base_icms: data.reducao_base_icms?.toString() || "",
        cfop_entrada: data.cfop_entrada || "",
        cfop_saida: data.cfop_saida || "",
        cst_ipi: data.cst_ipi || "",
        aliquota_ipi: data.aliquota_ipi?.toString() || "",
        cst_pis: data.cst_pis || "",
        cst_cofins: data.cst_cofins || "",
        aliquota_pis: data.aliquota_pis?.toString() || "",
        aliquota_cofins: data.aliquota_cofins?.toString() || "",
        comentario: data.comentario || "",
        ativo: data.ativo,
      });
      setEditOpen(true);
    } catch (error: any) {
      console.error("Erro ao carregar regra:", error);
      toast.error("Erro ao carregar regra fiscal");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta regra fiscal?")) return;

    try {
      const { error } = await supabase
        .from("fabrica_regras_fiscais_ncm")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Regra excluída com sucesso!");
      carregarRegras();
    } catch (error: any) {
      console.error("Erro ao excluir regra:", error);
      toast.error("Erro ao excluir regra fiscal");
    }
  };

  const resetForm = () => {
    setFormData({
      ncm_id: "",
      uf_origem: "",
      uf_destino: "",
      cst_icms_entrada: "",
      cst_icms_saida: "",
      aliquota_icms: "",
      aliquota_fcp: "",
      tem_st: false,
      mva: "",
      reducao_base_icms: "",
      cfop_entrada: "",
      cfop_saida: "",
      cst_ipi: "",
      aliquota_ipi: "",
      cst_pis: "",
      cst_cofins: "",
      aliquota_pis: "",
      aliquota_cofins: "",
      comentario: "",
      ativo: true,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Regras Fiscais por NCM + UF
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Regras Fiscais por NCM + UF</span>
              <Button onClick={() => { resetForm(); setEditingId(null); setEditOpen(true); }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NCM</TableHead>
                  <TableHead>UF Origem</TableHead>
                  <TableHead>UF Destino</TableHead>
                  <TableHead>CST ICMS</TableHead>
                  <TableHead>Alíq. ICMS</TableHead>
                  <TableHead>ST</TableHead>
                  <TableHead>CFOP Entrada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regras.map((regra) => (
                  <TableRow key={regra.id}>
                    <TableCell className="font-mono text-xs">
                      {regra.ncm_codigo}
                      <div className="text-muted-foreground truncate max-w-[200px]">{regra.ncm_descricao}</div>
                    </TableCell>
                    <TableCell>{regra.uf_origem}</TableCell>
                    <TableCell>{regra.uf_destino}</TableCell>
                    <TableCell>{regra.cst_icms_entrada}</TableCell>
                    <TableCell>{regra.aliquota_icms ? `${regra.aliquota_icms}%` : "-"}</TableCell>
                    <TableCell>{regra.tem_st ? "Sim" : "Não"}</TableCell>
                    <TableCell>{regra.cfop_entrada}</TableCell>
                    <TableCell>
                      <span className={regra.ativo ? "text-green-600" : "text-red-600"}>
                        {regra.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(regra.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(regra.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Regra Fiscal" : "Nova Regra Fiscal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <Label>NCM *</Label>
                <Select value={formData.ncm_id} onValueChange={(value) => setFormData({ ...formData, ncm_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o NCM" />
                  </SelectTrigger>
                  <SelectContent>
                    {ncms.map((ncm) => (
                      <SelectItem key={ncm.id} value={ncm.id}>
                        {ncm.codigo} - {ncm.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>UF Origem *</Label>
                <Select value={formData.uf_origem} onValueChange={(value) => setFormData({ ...formData, uf_origem: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>UF Destino *</Label>
                <Select value={formData.uf_destino} onValueChange={(value) => setFormData({ ...formData, uf_destino: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tem_st"
                  checked={formData.tem_st}
                  onCheckedChange={(checked) => setFormData({ ...formData, tem_st: checked as boolean })}
                />
                <Label htmlFor="tem_st">Tem Substituição Tributária</Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">ICMS</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>CST Entrada</Label>
                  <Input
                    value={formData.cst_icms_entrada}
                    onChange={(e) => setFormData({ ...formData, cst_icms_entrada: e.target.value })}
                    placeholder="00"
                  />
                </div>
                <div>
                  <Label>CST Saída</Label>
                  <Input
                    value={formData.cst_icms_saida}
                    onChange={(e) => setFormData({ ...formData, cst_icms_saida: e.target.value })}
                    placeholder="00"
                  />
                </div>
                <div>
                  <Label>Alíquota ICMS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_icms}
                    onChange={(e) => setFormData({ ...formData, aliquota_icms: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Alíquota FCP (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_fcp}
                    onChange={(e) => setFormData({ ...formData, aliquota_fcp: e.target.value })}
                  />
                </div>
                <div>
                  <Label>MVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.mva}
                    onChange={(e) => setFormData({ ...formData, mva: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Redução BC (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.reducao_base_icms}
                    onChange={(e) => setFormData({ ...formData, reducao_base_icms: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CFOP Entrada</Label>
                  <Input
                    value={formData.cfop_entrada}
                    onChange={(e) => setFormData({ ...formData, cfop_entrada: e.target.value })}
                    placeholder="1102"
                  />
                </div>
                <div>
                  <Label>CFOP Saída</Label>
                  <Input
                    value={formData.cfop_saida}
                    onChange={(e) => setFormData({ ...formData, cfop_saida: e.target.value })}
                    placeholder="5102"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">IPI</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CST IPI</Label>
                  <Input
                    value={formData.cst_ipi}
                    onChange={(e) => setFormData({ ...formData, cst_ipi: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Alíquota IPI (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_ipi}
                    onChange={(e) => setFormData({ ...formData, aliquota_ipi: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">PIS/COFINS</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>CST PIS</Label>
                  <Input
                    value={formData.cst_pis}
                    onChange={(e) => setFormData({ ...formData, cst_pis: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Alíquota PIS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_pis}
                    onChange={(e) => setFormData({ ...formData, aliquota_pis: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CST COFINS</Label>
                  <Input
                    value={formData.cst_cofins}
                    onChange={(e) => setFormData({ ...formData, cst_cofins: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Alíquota COFINS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_cofins}
                    onChange={(e) => setFormData({ ...formData, aliquota_cofins: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Comentário / Observações</Label>
              <Textarea
                value={formData.comentario}
                onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
              />
              <Label htmlFor="ativo">Regra Ativa</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setEditOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Regra"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

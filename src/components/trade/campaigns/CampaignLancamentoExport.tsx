import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Search, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useUserRole } from "@/hooks/useUserRole";

interface CampaignLancamentoExportProps {
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Customer {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
}

export function CampaignLancamentoExport({
  campaignId,
  campaignName,
  campaignCode,
  open,
  onOpenChange,
}: CampaignLancamentoExportProps) {
  const { isAdminOrSupervisor } = useUserRole();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch customers - filtered by vendedor if not admin
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-for-export", isAdminOrSupervisor],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("prospects")
        .select("id, nome_empresa, cnpj")
        .order("nome_empresa");

      if (!isAdminOrSupervisor) {
        query = query.eq("vendedor_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Customer[];
    },
    enabled: open,
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.nome_empresa.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.cnpj?.includes(searchQuery)
  );

  const handleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map((c) => c.id));
    }
  };

  const handleToggleCustomer = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleExport = () => {
    if (selectedCustomers.length === 0) {
      toast.error("Selecione pelo menos um cliente para exportar");
      return;
    }

    try {
      // Get selected customer data
      const selectedData = customers.filter((c) =>
        selectedCustomers.includes(c.id)
      );

      // Create worksheet data
      const wsData = [
        // Header row
        [
          "ID Cliente (NÃO ALTERAR)",
          "Nome do Cliente",
          "CNPJ",
          "Valor Pedido (R$)",
          "Tipo Brinde",
          "Sell Out Anterior (R$)",
          "Sell Out Atual (R$)",
          "UNON Anterior",
          "UNON Atual",
          "Observações",
        ],
        // Data rows with customer info pre-filled
        ...selectedData.map((customer) => [
          customer.id,
          customer.nome_empresa,
          customer.cnpj || "",
          "", // Valor Pedido - user fills
          "", // Tipo Brinde - user fills
          "", // Sell Out Anterior - user fills
          "", // Sell Out Atual - user fills
          "", // UNON Anterior - user fills
          "", // UNON Atual - user fills
          "", // Observações - user fills
        ]),
      ];

      // Create instructions sheet
      const instructionsData = [
        ["INSTRUÇÕES DE PREENCHIMENTO"],
        [""],
        ["Campanha:", campaignName],
        ["Código:", campaignCode],
        [""],
        ["CAMPOS OBRIGATÓRIOS:"],
        ["- ID Cliente: NÃO ALTERE este campo, é usado para identificar o cliente"],
        ["- Valor Pedido: Valor total do pedido em reais"],
        [""],
        ["CAMPOS OPCIONAIS:"],
        ["- Tipo Brinde: brinde_produto, desconto, bonificacao, kit_promocional, premio, outro"],
        ["- Sell Out Anterior: Valor de vendas no período anterior"],
        ["- Sell Out Atual: Valor de vendas no período atual"],
        ["- UNON Anterior/Atual: Quantidade de unidades vendidas"],
        ["- Observações: Comentários adicionais sobre a execução"],
        [""],
        ["IMPORTANTE:"],
        ["- Mantenha os IDs dos clientes inalterados"],
        ["- Use valores numéricos sem formatação (ex: 1500.50, não R$ 1.500,50)"],
        ["- Após preencher, importe o arquivo de volta no sistema"],
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add instructions sheet first
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");

      // Add data sheet
      const wsLancamentos = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      wsLancamentos["!cols"] = [
        { wch: 40 }, // ID Cliente
        { wch: 40 }, // Nome
        { wch: 20 }, // CNPJ
        { wch: 18 }, // Valor Pedido
        { wch: 18 }, // Tipo Brinde
        { wch: 20 }, // Sell Out Anterior
        { wch: 18 }, // Sell Out Atual
        { wch: 15 }, // UNON Anterior
        { wch: 12 }, // UNON Atual
        { wch: 40 }, // Observações
      ];

      XLSX.utils.book_append_sheet(wb, wsLancamentos, "Lançamentos");

      // Generate filename
      const fileName = `lancamentos_${campaignCode}_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);

      toast.success(`Planilha exportada com ${selectedData.length} cliente(s)`);
      onOpenChange(false);
      setSelectedCustomers([]);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar planilha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Modelo de Lançamentos
          </DialogTitle>
          <DialogDescription>
            Selecione os clientes que deseja incluir na planilha modelo.
            Preencha os dados e importe de volta para criar lançamentos em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome ou CNPJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={
                  filteredCustomers.length > 0 &&
                  selectedCustomers.length === filteredCustomers.length
                }
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Selecionar todos ({filteredCustomers.length})
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedCustomers.length} selecionado(s)
            </span>
          </div>

          {/* Customer List */}
          <ScrollArea className="h-[300px] border rounded-lg p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Nenhum cliente encontrado"
                    : "Nenhum cliente disponível"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleCustomer(customer.id)}
                  >
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => handleToggleCustomer(customer.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {customer.nome_empresa}
                      </p>
                      {customer.cnpj && (
                        <p className="text-xs text-muted-foreground">
                          {customer.cnpj}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCustomers.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Planilha ({selectedCustomers.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDown, FileSpreadsheet, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  exportarAprovacaoDiretoriaExcel,
  exportarAprovacaoDiretoriaPDF,
  OPCOES_DIRETORIA_PADRAO,
  type OpcoesAprovacaoDiretoria,
} from "@/lib/fabrica/exportAprovacaoDiretoria";
import type { VisaoDiretoria } from "@/lib/fabrica/visaoDiretoriaPrecos";

const OPCOES_KEY = "simulador:comparativo:diretoria";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  nomeUsuario: string;
  /** Monta a visão no momento da exportação (usa filtros e colunas atuais). */
  montarVisao: () => VisaoDiretoria;
}

export function AprovacaoDiretoriaDialog({ open, onOpenChange, uid, nomeUsuario, montarVisao }: Props) {
  const storageKey = `${OPCOES_KEY}:${uid}`;
  const padrao: OpcoesAprovacaoDiretoria = { ...OPCOES_DIRETORIA_PADRAO, elaboradoPor: nomeUsuario };
  const [opcoes, setOpcoes] = useState<OpcoesAprovacaoDiretoria>(padrao);
  const [gerando, setGerando] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setOpcoes(raw ? { ...padrao, ...JSON.parse(raw) } : padrao);
    } catch {
      setOpcoes(padrao);
    }
  }, [storageKey, nomeUsuario]); // eslint-disable-line react-hooks/exhaustive-deps

  const atualizar = (patch: Partial<OpcoesAprovacaoDiretoria>) => {
    setOpcoes((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* preferência opcional */
      }
      return next;
    });
  };

  const exportar = async (formato: "excel" | "pdf") => {
    setGerando(formato);
    try {
      const visao = montarVisao();
      if (formato === "excel") await exportarAprovacaoDiretoriaExcel(visao, opcoes);
      else exportarAprovacaoDiretoriaPDF(visao, opcoes);
      toast.success(formato === "excel" ? "Planilha para a diretoria gerada" : "PDF para a diretoria gerado");
      onOpenChange(false);
    } catch (e) {
      logger.error("Erro ao gerar visão de aprovação da diretoria", e);
      toast.error("Não foi possível gerar o documento para a diretoria");
    } finally {
      setGerando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprovação da diretoria</DialogTitle>
          <DialogDescription>
            Documento com a regra de formação de cada tabela, preço e multiplicador sobre o custo
            por produto, coluna de decisão e campos de assinatura. Usa o Perfil A, os filtros, as
            colunas visíveis e o agrupamento por linha que estão na tela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dir-titulo">Título</Label>
            <Input
              id="dir-titulo"
              value={opcoes.titulo}
              placeholder={OPCOES_DIRETORIA_PADRAO.titulo}
              onChange={(e) => atualizar({ titulo: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir-referencia">Referência (opcional)</Label>
            <Input
              id="dir-referencia"
              value={opcoes.referencia}
              placeholder="Ex.: Reajuste linha Baunilha"
              onChange={(e) => atualizar({ referencia: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dir-vigencia">Vigência proposta</Label>
              <Input
                id="dir-vigencia"
                value={opcoes.vigencia}
                placeholder="Ex.: A partir de 01/10/2026"
                onChange={(e) => atualizar({ vigencia: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-elaborado">Elaborado por</Label>
              <Input
                id="dir-elaborado"
                value={opcoes.elaboradoPor}
                onChange={(e) => atualizar({ elaboradoPor: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dir-multiplicador" className="font-normal">
              Mostrar multiplicador sobre o custo de fábrica
            </Label>
            <Switch
              id="dir-multiplicador"
              checked={opcoes.mostrarMultiplicador}
              onCheckedChange={(v) => atualizar({ mostrarMultiplicador: v })}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => atualizar(padrao)} disabled={gerando !== null}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão
          </Button>
          <Button variant="outline" onClick={() => void exportar("excel")} disabled={gerando !== null}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {gerando === "excel" ? "Gerando..." : "Excel"}
          </Button>
          <Button onClick={() => void exportar("pdf")} disabled={gerando !== null}>
            <FileDown className="h-4 w-4 mr-2" />
            {gerando === "pdf" ? "Gerando..." : "PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

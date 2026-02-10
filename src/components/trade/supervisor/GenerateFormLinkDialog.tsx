import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeamFormTokens } from "@/hooks/useTeamFormTokens";
import { Copy, ExternalLink, Link2, Loader2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function GenerateFormLinkDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [equipe, setEquipe] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [hoursValid, setHoursValid] = useState("24");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { generateToken } = useTeamFormTokens();

  const handleGenerate = async () => {
    if (!label.trim()) {
      toast({ title: "Informe um nome para o formulário", variant: "destructive" });
      return;
    }

    const tokenValue = await generateToken.mutateAsync({
      label: label.trim(),
      equipe_comercial: equipe.trim() || undefined,
      supervisor_nome: supervisor.trim() || undefined,
      hours_valid: parseInt(hoursValid) || 24,
    });

    setGeneratedToken(tokenValue);
  };

  const formLink = generatedToken
    ? `https://bimaster.online/formulario-equipe?token=${generatedToken}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formLink);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setLabel("");
    setEquipe("");
    setSupervisor("");
    setHoursValid("24");
    setGeneratedToken(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="h-4 w-4" />
          Gerar Link Formulário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Formulário Compartilhado</DialogTitle>
          <DialogDescription>
            Crie um link para os vendedores preencherem seus dados
          </DialogDescription>
        </DialogHeader>

        {!generatedToken ? (
          <div className="space-y-4">
            <div>
              <Label>Nome do Formulário *</Label>
              <Input
                placeholder="Ex: Equipe Fev/2026"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Equipe Comercial</Label>
                <Input
                  placeholder="Pré-preenche no form"
                  value={equipe}
                  onChange={(e) => setEquipe(e.target.value)}
                />
              </div>
              <div>
                <Label>Supervisor</Label>
                <Input
                  placeholder="Pré-preenche no form"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Validade (horas)</Label>
              <Input
                type="number"
                min="1"
                max="168"
                value={hoursValid}
                onChange={(e) => setHoursValid(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Padrão: 24h. Máximo: 168h (7 dias)</p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateToken.isPending}
              className="w-full"
            >
              {generateToken.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">Código de acesso:</p>
              <p className="text-2xl font-mono font-bold text-center tracking-widest text-primary">
                {generatedToken}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Válido por {hoursValid}h • Uso múltiplo
              </p>
            </div>

            <div>
              <Label>Link do formulário</Label>
              <div className="flex gap-2 mt-1">
                <Input value={formLink} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => window.open(formLink, "_blank")}>
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
              <Button className="flex-1" onClick={handleCopy}>
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={handleReset} className="w-full">
              Gerar outro link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

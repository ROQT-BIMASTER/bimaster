import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface AddressValue {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  complemento: string;
}

interface CepAddressFieldProps {
  value: AddressValue | null;
  onChange: (value: AddressValue) => void;
  required?: boolean;
}

const EMPTY_ADDRESS: AddressValue = {
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
  numero: "",
  complemento: "",
};

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

export function CepAddressField({ value, onChange, required }: CepAddressFieldProps) {
  const addr = value || EMPTY_ADDRESS;
  const [searching, setSearching] = useState(false);

  const update = useCallback(
    (patch: Partial<AddressValue>) => {
      onChange({ ...addr, ...patch });
    },
    [addr, onChange]
  );

  const lookupCep = useCallback(
    async (cep: string) => {
      const digits = cep.replace(/\D/g, "");
      if (digits.length !== 8) return;

      setSearching(true);
      try {
        // Try BrasilAPI first
        const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
        if (brRes.ok) {
          const data = await brRes.json();
          onChange({
            ...addr,
            cep: formatCep(digits),
            logradouro: data.street || "",
            bairro: data.neighborhood || "",
            cidade: data.city || "",
            uf: data.state || "",
          });
          return;
        }

        // Fallback to ViaCEP
        const viaRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (viaRes.ok) {
          const data = await viaRes.json();
          if (!data.erro) {
            onChange({
              ...addr,
              cep: formatCep(digits),
              logradouro: data.logradouro || "",
              bairro: data.bairro || "",
              cidade: data.localidade || "",
              uf: data.uf || "",
            });
            return;
          }
        }

        toast.error("CEP não encontrado");
      } catch {
        toast.error("Erro ao buscar CEP");
      } finally {
        setSearching(false);
      }
    },
    [addr, onChange]
  );

  const handleCepChange = (raw: string) => {
    const formatted = formatCep(raw);
    update({ cep: formatted });
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 8) {
      lookupCep(digits);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-input p-4 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
        <MapPin className="h-4 w-4" />
        Endereço
      </div>

      {/* CEP */}
      <div className="flex gap-2 items-end">
        <div className="w-40">
          <Label className="text-xs">CEP</Label>
          <div className="relative">
            <Input
              value={addr.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
            {searching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Logradouro + Número */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Logradouro</Label>
          <Input
            value={addr.logradouro}
            onChange={(e) => update({ logradouro: e.target.value })}
            placeholder="Rua, Av..."
          />
        </div>
        <div className="w-24">
          <Label className="text-xs">Nº</Label>
          <Input
            value={addr.numero}
            onChange={(e) => update({ numero: e.target.value })}
            placeholder="Nº"
          />
        </div>
      </div>

      {/* Complemento + Bairro */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Complemento</Label>
          <Input
            value={addr.complemento}
            onChange={(e) => update({ complemento: e.target.value })}
            placeholder="Apto, Bloco..."
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Bairro</Label>
          <Input
            value={addr.bairro}
            onChange={(e) => update({ bairro: e.target.value })}
            placeholder="Bairro"
          />
        </div>
      </div>

      {/* Cidade + UF */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Cidade</Label>
          <Input
            value={addr.cidade}
            onChange={(e) => update({ cidade: e.target.value })}
            placeholder="Cidade"
          />
        </div>
        <div className="w-20">
          <Label className="text-xs">UF</Label>
          <Input
            value={addr.uf}
            onChange={(e) => update({ uf: e.target.value })}
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}

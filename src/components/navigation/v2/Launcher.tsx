/**
 * Launcher ⌘K da navegação v2. Lista todos os módulos e páginas visíveis
 * ao usuário (respeitando permissões) com busca fuzzy.
 *
 * Coexiste com o CommandPalette existente — este é específico do v2 e
 * abre via botão dedicado / ⌘K quando a navegação v2 está ativa.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { resolveIcon } from "./icon";
import { useNavV2Data } from "./useNavV2Data";

interface LauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Launcher({ open, onOpenChange }: LauncherProps) {
  const navigate = useNavigate();
  const { categories } = useNavV2Data();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Para onde você quer ir?"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {categories.map((cat, idx) => (
          <div key={cat.key}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={cat.label}>
              {cat.modules.flatMap((mod) => {
                const ModIcon = resolveIcon(mod.icon);
                const moduleRow = (
                  <CommandItem
                    key={`mod-${mod.code}`}
                    value={`${cat.label} ${mod.label}`}
                    onSelect={() => mod.pages[0] && go(mod.pages[0].route)}
                  >
                    <ModIcon className="h-4 w-4 mr-2 text-primary" />
                    <span className="font-medium">{mod.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {mod.pages.length} {mod.pages.length === 1 ? "página" : "páginas"}
                    </span>
                  </CommandItem>
                );
                const pageRows = mod.pages.map((p) => {
                  const PIcon = resolveIcon(p.icon);
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${mod.label} ${p.label} ${p.route}`}
                      onSelect={() => go(p.route)}
                    >
                      <PIcon className="h-3.5 w-3.5 mr-2 ml-4 text-muted-foreground" />
                      <span>{p.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {p.route}
                      </span>
                    </CommandItem>
                  );
                });
                return [moduleRow, ...pageRows];
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

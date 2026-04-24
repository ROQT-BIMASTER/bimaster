import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Table primitives padronizados para harmonizar com Cards em qualquer paleta:
 *  - Wrapper Table tem `bg-card` + `border-border/60` + `rounded-md`, igualando
 *    o tratamento visual de Card e ficando coerente sob fundos custom (a paleta
 *    derivada por `getBgPaletteVars` recolore --card e --border automaticamente).
 *  - Cabeçalho usa `bg-muted/40` (token derivado), garantindo contraste
 *    consistente sobre qualquer fundo escolhido.
 *  - Bordas usam `border-border/60` para suavidade (mesmo tom dos Cards).
 *  - Cabeçalho (`h-11 px-4 py-3`) e células (`px-4 py-3`) compartilham padding
 *    horizontal e vertical, alinhando colunas pixel-a-pixel.
 *  - Hover/selecionado migram para `bg-muted/40`/`bg-muted/60` (via paleta) em
 *    vez de `bg-muted/50` cru.
 *  - Cabeçalho com `text-xs font-semibold uppercase tracking-wide` para
 *    diferenciação tipográfica clara entre header e body.
 */

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Quando true, o cabeçalho fica fixo durante a rolagem vertical da tabela. */
  stickyHeader?: boolean;
  /** Largura mínima da tabela para forçar scroll horizontal em telas estreitas.
   *  Aceita classes Tailwind (ex: "min-w-[720px]"). Default: "min-w-[640px]". */
  minWidthClass?: string;
  /** Classe extra aplicada ao wrapper externo (controla altura, padding, etc.). */
  wrapperClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, stickyHeader, minWidthClass = "min-w-[640px]", wrapperClassName, ...props }, ref) => (
    <div
      className={cn(
        // Wrapper: scroll horizontal suave + barra fina + sombras de overflow lateral
        "relative w-full overflow-x-auto overflow-y-auto rounded-md border border-border/60 bg-card",
        "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        // Sombras laterais indicando rolagem horizontal disponível (mask-image)
        "[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]",
        "supports-[mask-image:none]:[mask-image:none]",
        stickyHeader && "max-h-[70vh]",
        wrapperClassName,
      )}
      data-sticky-header={stickyHeader || undefined}
    >
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm border-collapse",
          minWidthClass,
          // Quando sticky, o thead recebe position sticky (handled em TableHeader via :where)
          stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn("bg-muted/40 [&_tr]:border-b [&_tr]:border-border/60", className)}
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-border/60 bg-muted/40 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/60 transition-colors data-[state=selected]:bg-muted/60 hover:bg-muted/40",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };

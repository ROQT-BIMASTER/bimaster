

# Visual Link Between Kit Item and Origin Product

## Problem
When expanding a "Produto do Kit" row in the cost sheet, the `InsumosOrigemPanel` shows the origin product's cost breakdown, but there's no visual indication connecting the kit item to its origin. The user wants it to be visually obvious that one is linked to the other.

## Solution

### 1. Style the "importado_kit" table row distinctly
- Add a left border accent (e.g., `border-l-2 border-l-blue-500`) and subtle background (`bg-blue-50/50 dark:bg-blue-950/20`) to rows with `tipo_insumo === "importado_kit"`, similar to the Display kit pattern already used in the product listing.
- Add a small link icon (`Link2` from lucide) next to the "Kit" badge on the item name.

### 2. Style the InsumosOrigemPanel with visual connection
- Wrap the panel in a container with a matching left border (`border-l-2 border-l-blue-500 ml-4`) to create a visual "tree branch" effect connecting it to the parent row.
- Add a connecting line element (a small vertical + horizontal line) from the parent row to the panel header, reinforcing the parent-child relationship.

### 3. Enhanced header on InsumosOrigemPanel
- Show the origin product code prominently with a link icon.
- Add a subtle "Vinculado a:" label before the product name.

## Files to Change
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` — Add distinct styling to `importado_kit` rows and link icon.
- `src/components/fabrica/InsumosOrigemPanel.tsx` — Add left border connector and enhanced header with link visual.


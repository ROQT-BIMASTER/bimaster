

# Exibir Número da NF nos Insumos de Produtos Vinculados

## Problema

Na tela de revisão de fichas, a tabela de insumos dos **Produtos Vinculados** (Kit ↔ Unidade) não mostra o número da Nota Fiscal de referência (`nf_referencia`), embora esse dado já exista no snapshot.

## Solução

Adicionar uma coluna **"NF Ref."** na tabela de insumos expandível dos produtos vinculados em `FichaAnalisePanel.tsx`.

## Mudança

**Arquivo: `src/components/fabrica/FichaAnalisePanel.tsx`** (linhas 411-430)

Adicionar uma nova coluna `NF Ref.` no `TableHeader` e exibir `ins.nf_referencia` no `TableBody`:

```tsx
// Header — adicionar após "Fornecedor"
<TableHead className="text-xs">NF Ref.</TableHead>

// Body — adicionar após fornecedor
<TableCell className="text-xs py-1.5 font-mono">{ins.nf_referencia || "-"}</TableCell>
```

A tabela ficará com as colunas: Código | Insumo | Fornecedor | **NF Ref.** | NF (R$) | Serviço (R$) | Condição (R$)

Nenhuma mudança em banco de dados é necessária — o campo `nf_referencia` já está presente nos snapshots salvos.


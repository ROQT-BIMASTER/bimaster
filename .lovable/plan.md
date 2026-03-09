

## Plano: Mostrar documentos do Cofre vinculados a cada etapa do Checklist Pré-Lançamento

### O que muda

Na seção "Checklist Pré-Lançamento" do `ProductLaunchPanel`, cada etapa passará a ser expandível. Ao clicar, mostra os documentos do cofre (`cofreDocs`) que pertencem àquela categoria.

### Implementação

**Arquivo**: `src/components/projetos/ProductLaunchPanel.tsx`

1. **Alterar `ChecklistItem`** para incluir os documentos correspondentes:
   ```ts
   interface ChecklistItem {
     key: string;
     label: string;
     icon: ReactNode;
     done: boolean;
     docs: any[]; // documentos do cofre com essa categoria
   }
   ```

2. **No `useMemo` do checklist** (linha ~156), associar os documentos filtrados por categoria a cada item:
   ```ts
   docs: cofreDocs.filter((d: any) => d.categoria === item.key)
   ```

3. **Adicionar estado `expandedChecklist`** (`string | null`) para controlar qual item está expandido.

4. **Na renderização de cada item** (linhas ~418-433):
   - Tornar a linha clicável (quando `item.docs.length > 0`)
   - Adicionar badge com contagem de documentos
   - Adicionar chevron indicando expansão
   - Quando expandido, mostrar sub-lista com:
     - Nome do arquivo (`nome_arquivo`)
     - Status do documento (badge: ativo/aprovado)
     - Data de envio formatada
     - Ícone `FileText` para cada documento

### Visual esperado

```text
✅ Briefing              [2 docs] ▼
   📄 Briefing_Produto_X.pdf    ativo   12/03
   📄 Briefing_v2.pdf           aprovado 14/03
○  Arte Final                   
✅ Rótulo                [1 doc]  ▶
○  Ficha Técnica
```

### Escopo
- Apenas 1 arquivo editado: `ProductLaunchPanel.tsx`
- Sem mudanças no banco de dados
- Usa dados já disponíveis em `cofreDocs`


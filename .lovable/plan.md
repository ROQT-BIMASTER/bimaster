

## Transformar "Arte Enviada" em "Envios ao Brasil" — Painel de Transferências

### Conceito

Substituir o card isolado "Arte Enviada" e a seção de upload de arte final por um conceito mais amplo: **"Envios ao Brasil"** (发送至巴西). Em vez de rastrear apenas a arte final, esse card passa a representar **todos os documentos oficializados e assinados que o Brasil já enviou de volta à China** — e vice-versa, documentos prontos para transferência.

O card no painel principal (`ChinaFabrica`) mostrará um contador agregado de documentos oficiais transferidos (oficializados + assinados), e a seção na ficha do produto (`ChinaFichaProduto`) será reformulada em um painel visual de "Transferências Oficiais" com status de cada envio.

### Mudanças

**1. Card no painel `ChinaFabrica.tsx`**
- Renomear "Arte Enviada / 终稿已发送" → **"Envios ao Brasil / 发送至巴西"**
- Trocar ícone `Send` → `PackageCheck` (ou `ArrowDownLeft`)
- Contador: em vez de `stats.arte_enviada`, consultar quantidade de submissões que possuem documentos oficializados + assinados (query nos `china_produto_documentos` onde `oficializado = true AND assinado_por IS NOT NULL`)
- Ao clicar, filtrar a lista de recebimentos por submissões com envios oficiais

**2. Seção na ficha `ChinaFichaProduto.tsx`**
- Remover a seção "Arte Final + EAN" (linhas ~511-571) que faz upload de um único arquivo
- Substituir por um card **"Transferências Oficiais ao Brasil"** que:
  - Lista todos os documentos da submissão que foram oficializados e assinados eletronicamente
  - Mostra para cada doc: tipo, nome do arquivo, quem assinou, data da assinatura, badge "Oficial"
  - Se não há documentos oficiais ainda, mostra mensagem orientativa
  - O EAN Caixa Master permanece como campo editável avulso se já existir

**3. Status flow cleanup**
- Manter `arte_enviada` como status válido no banco (backward compatibility), mas renomear labels em todos os arquivos:
  - `STATUS_LABELS`: `arte_enviada` → `{ pt: "Docs Enviados", cn: "文件已发送" }`
  - `ChinaProdutoWidget`: mesma atualização
  - `AprovacaoSubmissaoChina`: mesma atualização
  - `ProjetoVincularChina`: mesma atualização

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/ChinaFabrica.tsx` | Renomear card, trocar ícone, ajustar query de contagem |
| `src/pages/ChinaFichaProduto.tsx` | Remover seção Arte Final, criar card Transferências Oficiais |
| `src/lib/china-document-types.ts` | Renomear label de `arte_enviada` |
| `src/components/china/ChinaProdutoWidget.tsx` | Renomear label |
| `src/components/produto-brasil/AprovacaoSubmissaoChina.tsx` | Renomear label |
| `src/pages/ProjetoVincularChina.tsx` | Renomear label |


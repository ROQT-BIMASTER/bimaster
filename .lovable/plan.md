

## Plano: Isolamento Fábrica Brasil vs Produtos Importados

### Problema

Hoje o plano anterior propunha "promover" o produto do pré-cadastro diretamente para `fabrica_produtos`, o que misturaria produtos nacionais e importados na mesma tabela e listagem. A equipe da Fábrica Brasil **não pode ver** produtos importados, e alterações no fluxo de importados **não podem afetar** o que está em produção.

### Estratégia de Isolamento

Em vez de criar produtos importados dentro de `fabrica_produtos`, o fluxo de importados permanecerá **completamente separado** usando a tabela `produtos_brasil` já existente como tabela principal para todo o ciclo de vida do produto importado (pré-cadastro → ativo → precificação).

```text
FÁBRICA BRASIL (nacional)         IMPORTADOS (China)
─────────────────────────         ──────────────────
fabrica_produtos                  produtos_brasil
fabrica_custos_config             produtos_brasil_custos (NOVA)
fabrica_precos_produtos           produtos_brasil_precos (NOVA)
fabrica_tabelas_preco             (usa mesmas tabelas de preço)
```

### Alterações

---

**1. Expandir `produtos_brasil` como tabela definitiva (não apenas staging)**

Adicionar campos completos para que o produto importado viva inteiramente nesta tabela, sem jamais migrar para `fabrica_produtos`:

- NCM, EANs (unitário/display/master), tipo_produto, marca, linha, fabricante, SKU, foto_url
- Dados de processo: data_inicio_processo, data_previsao_chegada, data_cadastro_finalizado
- Dados ANVISA: processo_anvisa, nome_comercial
- Custos: custo_unitario_china, peso_bruto, peso_liquido, itens_display

---

**2. Nova tabela `produtos_brasil_custos`**

Espelha `fabrica_custos_config` mas referencia `produtos_brasil`:

- Campos: produto_brasil_id, custo_base, markup, impostos, frete, margem
- Permite ficha de custos independente para importados

---

**3. Nova tabela `produtos_brasil_precos`**

Espelha `fabrica_precos_produtos` mas referencia `produtos_brasil`:

- Campos: produto_brasil_id, tabela_id, preco_calculado, preco_final, markup aplicado
- Permite que importados entrem nas tabelas de preço sem poluir a listagem de produtos nacionais

---

**4. Filtro de isolamento na Fábrica Brasil (proteção do que está em produção)**

Adicionar filtro explícito em `FabricaProdutosAcabados.tsx` e todas as queries de `fabrica_produtos`:

```typescript
// Garantir que NUNCA mostre produtos importados na Fábrica
.or('origem.is.null,origem.neq.importado')
```

Isso é uma proteção defensiva — como importados ficam em `produtos_brasil`, não deveriam aparecer, mas o filtro garante segurança caso alguém insira manualmente.

---

**5. Módulo "Produtos Importados" separado no menu**

- Nova entrada no sidebar: "Produtos Importados" (dentro de Projetos ou como módulo próprio)
- Listagem própria com KPIs: Total, Em Pré-cadastro, Ativos, Com Ficha de Custo
- Tela de cadastro com abas (idêntica à Fábrica, mas dados de `produtos_brasil`)
- Ficha de Custos própria para importados
- Permissão de tela separada: `produtos_importados`

---

**6. Regras de permissão**

| Módulo | Quem acessa |
|---|---|
| Fábrica > Produtos Acabados | Equipe Fábrica (não vê importados) |
| Projetos > Produtos Importados | Equipe Projetos (não vê nacionais) |
| Preços > Tabelas de Preço | Ambos (cada um vê apenas seus produtos na matriz) |

A tela de Tabelas de Preço mostrará seções ou abas separadas: "Produtos Nacionais" e "Produtos Importados", cada um puxando da sua tabela respectiva.

---

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| Migration SQL | Expandir `produtos_brasil` + criar `produtos_brasil_custos` e `produtos_brasil_precos` + RLS |
| `src/pages/FabricaProdutosAcabados.tsx` | Adicionar filtro `.or('origem.is.null,origem.neq.importado')` defensivo |
| `src/pages/ProdutoBrasilCadastro.tsx` | Redesenho com abas completas (espelhando NovoProdutoAcabadoDialog) |
| `src/pages/ProdutosBrasilListagem.tsx` | KPIs + filtros + tabela visual espelhando Fábrica |
| `src/components/produto-brasil/FichaCustoImportado.tsx` | **Nova** — ficha de custos para importados |
| `src/hooks/useProdutoBrasil.ts` | Campos expandidos + hooks de custos/preços |
| `src/components/dashboard/AppSidebar.tsx` | Reorganizar menu para "Produtos Importados" |
| `src/App.tsx` | Rotas novas para ficha de custo de importados |

### Garantia de zero impacto na Fábrica

- Nenhuma coluna é adicionada ou removida de `fabrica_produtos`
- Nenhuma query existente da Fábrica é alterada (apenas filtro defensivo adicionado)
- Produtos importados vivem 100% em `produtos_brasil` e tabelas derivadas
- RLS separada por tabela garante isolamento no banco de dados


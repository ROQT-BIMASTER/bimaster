

# Ficha Unificada do Produto — Tela Única para China e Brasil

## O que é

Uma página unificada (`ChinaFichaProduto`) que consolida **tudo** sobre um produto em uma só tela, conforme o wireframe. Tanto a China quanto o Brasil usam essa mesma página — cada seção exibe ou permite editar dados conforme o status do produto.

## Layout (baseado no wireframe)

```text
┌─────────────────────────────────────────────────────────┐
│ FICHA DO PRODUTO 产品档案                               │
│ Código: TGV-001  Nome: Produto X   [Status Badge]      │
├──────────────────────────┬──────────────────────────────┤
│                          │  📷 Foto Produto             │
│  GRADE (display)         │  (foto principal)            │
│  ● Cor1  Qtd=6  EAN     │                              │
│  ● Cor2  Qtd=6  EAN     │  📁 Cofre Documentos         │
│  ● Cor3  Qtd=6  EAN     │  (link p/ cofre vinculado)   │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│ ROTULAGEM 标签                                          │
│  □ Volumetria (líq+bruto) — dados volumétricos          │
│  □ Fórmula (01, 02, 03) — código da fórmula            │
│  □ Doc Regulatória                                      │
├─────────────────────────────────────────────────────────┤
│ EMBALAGEM 包装                                          │
│  □ Desenhos técnicos (facas)                            │
│  □ Provadores / Tester                                  │
│  □ Embalagem Primária                                   │
│  □ Display                                              │
│  □ Etiqueta                                             │
│  □ Amostras (foto+vídeo) — vincular produtos, fotos    │
├─────────────────────────────────────────────────────────┤
│ ARTE FINAL + EAN (seção Brasil→China)                   │
├──────────────────────────┬──────────────────────────────┤
│ ORDEM DE COMPRA 采购订单  │ ORDEM DE PRODUÇÃO 生产订单   │
│ Nº 01   Qtde: 50        │ Qtde produzida: 30           │
│                          │ Qtd Pendente: 20             │
└──────────────────────────┴──────────────────────────────┘
```

## Implementação

### 1. Criar `src/pages/ChinaFichaProduto.tsx`

Página unificada que busca e exibe tudo de uma submissão em seções:

- **Header**: código, nome, status badge, foto do produto (do campo `foto_url` ou primeira foto de amostra)
- **Grade**: `ChinaGradeView` com cores, EANs, quantidades — reutiliza componente existente
- **Cofre/Documentos vinculados**: Link para cofre de documentos se houver vínculo (campo futuro ou busca por código)
- **Rotulagem**: Cards dos documentos da categoria "rotulagem" com status (aprovado/pendente/rejeitado) — China pode fazer upload, Brasil pode aprovar/rejeitar
- **Embalagem**: Cards dos documentos da categoria "embalagem" — mesma lógica
- **Arte Final + EAN**: Seção visível quando status ≥ aprovado — Brasil envia arte, China vê download + EAN
- **Ordem de Compra**: Se existe OC vinculada, mostra número, qtd total, data entrega
- **Ordem de Produção**: Progresso visual (barra), qtd produzida, qtd pendente, link para detalhe da OC
- **Observações**: Feedbacks Brasil, docs rejeitados

### 2. Funcionalidades inline (sem navegar para outras páginas)

- **Upload de documentos** pela China diretamente nos slots (reutiliza `ChinaDocumentSlot`)
- **Aprovar/Rejeitar** documentos pelo Brasil inline (botões ✓/✗)
- **Enviar arte + EAN** pelo Brasil inline (mesma lógica do `ChinaRecebimentos`)
- **Emitir OC** via dialog (reutiliza `EmitirOCDialog`)
- **Registrar produção** via dialog/inline (reutiliza `ChinaApontamentoForm`)

### 3. Registrar rota

```
/dashboard/fabrica-china/produto/:id → ChinaFichaProduto
```

Atualizar links em `ChinaRecebimentos`, `ChinaFabrica`, e `ChinaOrdens` para apontar para esta ficha.

### 4. Atualizar `ChinaFabrica.tsx`

Atualizar o card "Minhas Submissões" para linkar direto às fichas em vez da listagem genérica.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/ChinaFichaProduto.tsx` | **Criar**: página unificada com todas as seções |
| `src/App.tsx` | Editar: nova rota `/dashboard/fabrica-china/produto/:id` |
| `src/pages/ChinaRecebimentos.tsx` | Editar: links apontam para ficha unificada |
| `src/pages/ChinaOrdens.tsx` | Editar: link do produto aponta para ficha |
| `src/pages/ChinaFabrica.tsx` | Editar: navegação atualizada |


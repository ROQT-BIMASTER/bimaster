

# Pasta Digital TJSP — Iniciar a partir do Checklist de Documentos (Vincular China)

## Problema atual

Existe um painel `ChinaPastaDigitalPanel` separado dentro da Ficha do Produto China que duplica documentos da tabela `china_produto_documentos` para uma tabela `china_pasta_digital`. O usuário quer que a Pasta Digital TJSP seja construída diretamente a partir dos uploads do Checklist de Documentos, sem duplicação, e que a entrada principal seja pela tela **Vincular China**.

## Mudanças propostas

### 1. Adicionar aba/seção "Pasta Digital" na tela Vincular China

Quando uma submissão é selecionada e está vinculada, exibir uma seção Pasta Digital TJSP abaixo do painel principal (ou como aba) que:
- Lê diretamente da tabela `china_produto_documentos` (sem duplicar para `china_pasta_digital`)
- Organiza os documentos por categorias do DOCUMENT_CATEGORIES (que já mapeiam para as fases TJSP)
- Exibe no layout de árvore hierárquica com painel dividido (visualizador + parecer)
- Mantém a estética TJSP: fases colapsáveis, contagem de peças, ícone de status de parecer

### 2. Criar componente `PastaDigitalFromChecklist`

Novo componente que:
- Recebe `submissaoId` como prop
- Usa `useDocumentosDaSubmissao` existente para buscar documentos
- Agrupa por `DOCUMENT_CATEGORIES` no formato TJSP (árvore de fases)
- Painel esquerdo: árvore de fases com documentos (colapsáveis)
- Painel direito: visualizador de documento selecionado
- Suporta parecer/status já existente nos documentos (`status` field)
- Botão "Re-importar" atualiza a query

### 3. Remover ChinaPastaDigitalPanel da Ficha do Produto

- Remover o bloco `ChinaPastaDigitalPanel` de `ChinaFichaProduto.tsx`
- A Pasta Digital agora vive exclusivamente em Vincular China
- A tabela `china_pasta_digital` permanece no banco (sem migration destrutiva) mas deixa de ser usada

### 4. Integração na tela Vincular China

Adicionar a Pasta Digital como uma seção que aparece quando:
- Uma submissão está selecionada
- A submissão possui documentos no checklist

```text
┌─────────────────────────────────────────────────┐
│  Vincular Envio China (tela atual)              │
│  ┌─────────┬──────────────┬────────────┐        │
│  │Sidebar  │ Submissões   │ Projeto    │        │
│  │         │              │ & Tarefas  │        │
│  └─────────┴──────────────┴────────────┘        │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 📂 Pasta Digital 数字档案 (TJSP)         │   │
│  │  ┌─────────────────┬─────────────────┐   │   │
│  │  │ Árvore de Fases │ Visualizador    │   │   │
│  │  │ (categorias do  │ (PDF/Imagem)    │   │   │
│  │  │  checklist)     │                 │   │   │
│  │  └─────────────────┴─────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Despachos / Process Orchestration (existente)   │
└─────────────────────────────────────────────────┘
```

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `src/components/china/PastaDigitalFromChecklist.tsx` | Criar — componente TJSP lendo de `china_produto_documentos` |
| `src/pages/ProjetoVincularChina.tsx` | Editar — adicionar seção Pasta Digital |
| `src/pages/ChinaFichaProduto.tsx` | Editar — remover `ChinaPastaDigitalPanel` |

## Detalhes técnicos

- Mapeamento de categorias: usa `DOCUMENT_CATEGORIES` existente (Dados Oficiais, Fotos, Imagens Gerais, Rotulagem, Embalagem, Etiquetas, Artes, EANs, Amostras) como "fases" da árvore TJSP
- Status do documento (`aprovado`, `rejeitado`, `pendente`, `rascunho`) mapeia para os ícones de parecer TJSP
- Visualizador reutiliza `getSignedUrl` + iframe/img como no `ChinaPastaDigitalPanel` existente
- Sem migration — apenas mudança de frontend


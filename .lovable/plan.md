

# Plano: Destaque de Documentos do Cofre + Aba de Documentos no Chat

## Alterações

### 1. Cor diferente para anexos enviados ao cofre (`RevisaoChatPanel.tsx`)

- Precisamos saber, na renderização da mensagem, se aquele anexo foi para o cofre ou não
- Adicionar campo `enviado_para_cofre` (boolean) ao array `anexos` da mensagem (no JSONB), gravando `true` quando o checkbox estiver marcado
- Na renderização dos anexos dentro do balão, usar cor diferenciada:
  - **Cofre**: fundo verde/emerald com ícone de cofre (`Shield` ou `FolderOpen`) em vez do `FileText`
  - **Normal**: manter o estilo atual (azul/muted)

### 2. Aba lateral "Documentos" dentro do chat do produto

- Usar `ResizablePanelGroup` (horizontal) para dividir o chat em dois painéis:
  - **Painel esquerdo**: chat atual (mensagens + input)
  - **Painel direito**: lista de documentos do cofre vinculados ao produto (reutilizar lógica do `DocumentosTab`)
- O painel direito mostra apenas documentos que foram para o cofre (`fabrica_revisao_documentos` filtrado por `produto_id`)
- Aba colapsável ou toggle para mostrar/esconder o painel de documentos

### 3. Mudanças específicas

**`RevisaoChatPanel.tsx`**:
- No `enviarMensagem`: ao gravar `anexosMeta`, incluir `enviado_para_cofre: enviarParaCofre` em cada item do array
- Na renderização dos anexos (linhas ~470-490): checar `anexo.enviado_para_cofre` para aplicar estilo verde + ícone diferente + badge "Cofre"
- Envolver o card inteiro em `ResizablePanelGroup` com handle, painel esquerdo = chat, painel direito = `DocumentosTab` (passando `produtoId`)
- Adicionar toggle/botão no header para abrir/fechar o painel de documentos

**Interface `Mensagem.anexos`**: adicionar campo `enviado_para_cofre?: boolean` ao tipo

### Resumo visual

```text
┌──────────────────────────────┬─────────────────────┐
│       CHAT (mensagens)       │  DOCUMENTOS COFRE   │
│                              │  (do produto)       │
│  ┌─────────────────────┐     │                     │
│  │ msg com anexo normal │     │  📄 orcamento.pdf  │
│  │  📎 arquivo.pdf     │     │  📄 contrato.pdf   │
│  └─────────────────────┘     │  📄 nf.pdf         │
│  ┌─────────────────────┐     │                     │
│  │ msg com anexo cofre  │     │                     │
│  │  🛡️ doc.pdf  COFRE  │     │                     │
│  └─────────────────────┘     │                     │
│                              │                     │
│  [📎] [input...    ] [enviar]│                     │
└──────────────────────────────┴─────────────────────┘
```


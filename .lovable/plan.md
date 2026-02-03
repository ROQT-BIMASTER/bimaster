
# Plano: Melhorias na Importação de Insumos via IA

## Resumo das Mudanças

Este plano implementa 4 melhorias principais:
1. Ajustar layout para não cortar valores
2. Obrigar conferência item a item antes de importar
3. Adicionar aviso de responsabilidade do usuário
4. Permitir colar texto além de imagem

---

## 1. Novo Layout com Valores Completos

### Problema Atual
Os valores estão sendo cortados porque usamos `truncate` no nome e layout compacto.

### Solução
Trocar o layout de cards para uma **tabela responsiva** com colunas ajustáveis:

```text
+---------------------------------------------------------------------------------+
| [x] | Código  | Nome               | Fornecedor | NF        | Serv.     | Cond. |
+---------------------------------------------------------------------------------+
| [x] | 22904   | Bulk               | Rodrigues  | 0.188302  | 0.188302  | 0.00  |
| [ ] | 00987   | Frasco 50ml        | GlassCo    | 0.245000  | 0.245000  | 0.00  |
| [x] | 12345   | Tampa rosca        | PackBR     | 0.123456  | 0.123456  | 0.00  |
+---------------------------------------------------------------------------------+
```

- Usar `min-w-[...]` nas colunas para garantir visibilidade
- Valores numéricos alinhados à direita
- Scroll horizontal se necessário

---

## 2. Conferência Item a Item Obrigatória

### Fluxo Proposto

```text
Etapa 1: Upload        →  Etapa 2: Conferência     →  Etapa 3: Confirmação
(imagem ou texto)         (item por item)              (termo + importar)
```

### Mecânica de Conferência

- Cada item começa com status **"Não conferido"**
- Usuário deve clicar em cada item para **marcar como conferido**
- Adicionar badge visual de status:
  - Amarelo: "Pendente de conferência"
  - Verde: "Conferido"
- Botão "Importar" só habilita quando **todos os selecionados** estiverem conferidos

### Interface de Conferência

```text
+---------------------------------------------------------------------------------+
| Item 1 de 5                                           [Anterior] [Próximo]      |
+---------------------------------------------------------------------------------+
| Código: 22904                    Status: 🟡 Pendente                            |
| Nome: Bulk                                                                       |
| Fornecedor: Rodrigues                                                            |
|                                                                                  |
| Custos:                                                                          |
|   NF: R$ 0.188302                                                                |
|   Serviço: R$ 0.188302                                                           |
|   Condição: R$ 0.00                                                              |
|   NF Ref: -                                                                      |
|                                                                                  |
|          [ Rejeitar Item ]   [ ✓ Confirmar e Avançar ]                          |
+---------------------------------------------------------------------------------+
| Progresso: ██████░░░░ 3/5 conferidos                                            |
+---------------------------------------------------------------------------------+
```

---

## 3. Aviso de Responsabilidade

### Localização
No footer do dialog, antes do botão de importar.

### Texto

```text
⚠️ IMPORTANTE: Os dados foram extraídos automaticamente por IA.
É de sua responsabilidade verificar se todos os valores estão corretos
antes de confirmar a importação.

[ ] Li e concordo que conferi todos os itens e assumo responsabilidade
    pela validação dos dados importados.
```

### Lógica
- Checkbox obrigatório para habilitar o botão "Importar"
- Combina com a conferência item a item

---

## 4. Opção de Colar Texto

### Interface de Upload Atualizada

```text
+--------------------------------------------------+
|  Como deseja importar?                           |
|                                                   |
|  [📷 Enviar Imagem]    [📋 Colar Texto]          |
+--------------------------------------------------+
```

### Área de Texto

```text
+--------------------------------------------------+
| Cole aqui o texto da tabela de custos:           |
|                                                   |
| +----------------------------------------------+ |
| | Código  Nome         Fornecedor  NF    Serv  | |
| | 22904   Bulk         Rodrigues   0.18  0.18  | |
| | 00987   Frasco 50ml  GlassCo     0.24  0.24  | |
| |                                              | |
| |                                              | |
| +----------------------------------------------+ |
|                                                   |
|                        [Processar com IA]        |
+--------------------------------------------------+
```

### Alterações na Edge Function

A edge function precisa aceitar também um campo `text` e processar de forma diferente:

```typescript
// Se receber imagem
if (image) {
  content = [
    { type: "text", text: promptImagem },
    { type: "image_url", image_url: { url: image } }
  ];
}

// Se receber texto
if (text) {
  content = [
    { type: "text", text: promptTexto + "\n\nTexto da tabela:\n" + text }
  ];
}
```

---

## Estrutura de Estados

```typescript
// Estados atualizados
const [modoInput, setModoInput] = useState<"imagem" | "texto">("imagem");
const [textoColado, setTextoColado] = useState("");
const [etapa, setEtapa] = useState<"upload" | "conferencia" | "confirmacao">("upload");
const [itemAtual, setItemAtual] = useState(0);
const [aceitouResponsabilidade, setAceitouResponsabilidade] = useState(false);

// Novo campo no InsumoExtraido
interface InsumoExtraido {
  // ... campos existentes
  conferido: boolean; // NOVO
  rejeitado: boolean; // NOVO
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fabrica/ImportarInsumosIA.tsx` | Refatorar toda a UI com novo fluxo de 3 etapas |
| `supabase/functions/extrair-insumos-imagem/index.ts` | Aceitar campo `text` além de `image` |

---

## Fluxo Completo

```text
1. Usuário clica "Importar com IA"
2. Escolhe: Imagem ou Texto
3. Envia imagem OU cola texto
4. IA processa e retorna insumos
5. Entra na tela de conferência item a item
6. Para cada item: Confirma ou Rejeita
7. Após todos conferidos:
   - Mostra resumo
   - Checkbox de responsabilidade
   - Botão importar habilitado
8. Importa apenas os confirmados
```

---

## Validações de Segurança

1. **Conferência obrigatória**: Não permite pular itens
2. **Checkbox obrigatório**: Termo de responsabilidade
3. **Feedback visual claro**: Status de cada item
4. **Barra de progresso**: Mostra quantos faltam conferir

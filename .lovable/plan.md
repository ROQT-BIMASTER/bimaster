

## Plano: Termo de Responsabilidade para Cadastro via IA

### Contexto
O projeto já possui um padrão de termos de responsabilidade na Ficha de Custos (checkbox + texto legal + registro no banco). Vamos replicar esse padrão para o fluxo de cadastro de produto via IA.

### O que será feito

**1. Tela de escolha no dialog (novo produto, não edição)**
- Ao abrir "Novo Produto Acabado", exibir duas opções: **Preencher Manualmente** e **Cadastrar com IA**
- Edição de produto existente vai direto para o formulário (sem opção IA)

**2. Fluxo IA com termo obrigatório**
- Se o usuário escolher IA, exibir uma tela com:
  - Textarea para colar texto do ERP
  - Upload de imagem (print do ERP)
  - Botão "Analisar com IA"
- **Antes de analisar**, o usuário deve aceitar um termo de responsabilidade:
  - Texto explicando que os dados extraídos pela IA são sugestões e devem ser validados
  - Checkbox obrigatório: "Li e concordo com os termos"
  - O botão "Analisar com IA" fica desabilitado até aceitar

**3. Termo de responsabilidade (texto)**
```
"Declaro estar ciente de que os dados extraídos por Inteligência Artificial 
são sugestões automáticas e podem conter erros ou imprecisões. Assumo total 
responsabilidade pela revisão, validação e correção de todos os campos antes 
de salvar o cadastro do produto."
```

**4. Nova Edge Function `extrair-produto-ia`**
- Recebe texto ou imagem (base64)
- Usa `google/gemini-2.5-flash` para texto, `google/gemini-2.5-pro` para imagem
- Prompt especializado para extrair campos do produto (código, nome, SKU, EAN, NCM, categoria, marca, linha, origem, etc.)
- Retorna JSON estruturado

**5. Após análise da IA**
- Preenche automaticamente os campos do formulário
- Exibe o formulário normal para revisão e ajustes manuais
- Campos preenchidos pela IA recebem um indicador visual sutil (badge ou ícone)

**6. Registro de auditoria**
- Ao salvar um produto cadastrado via IA, registrar no `audit_logs` que o cadastro usou IA, incluindo: usuário, data/hora do aceite do termo, e método (texto/imagem)

### Arquivos envolvidos
- `src/components/fabrica/NovoProdutoAcabadoDialog.tsx` — adicionar estados de modo (choose/ai/form), componente do termo e input IA
- `supabase/functions/extrair-produto-ia/index.ts` — nova edge function
- `supabase/config.toml` — registrar a nova function com `verify_jwt = false`


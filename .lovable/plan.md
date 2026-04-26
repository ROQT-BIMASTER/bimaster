## Diagnóstico

Os três botões da tela de detalhe da tarefa (`Sugerir com IA`, `Importar Briefing`, `Gerar checklist IA`) chamam edge functions que usam o modelo **`google/gemini-3-flash-preview`** — um modelo *preview*, instável para **tool calling** (que todas as três operações exigem para retornar JSON estruturado).

Quando o modelo preview não emite `tool_calls`, o código lança erros como:
- `"IA não retornou sugestões"`
- `"IA não retornou checklist"`
- `"IA não conseguiu interpretar o arquivo"`

…que aparecem como toast vermelho no frontend, dando a impressão de que "as funções de IA não estão funcionando".

A última chamada à `projeto-ia-assistant` voltou HTTP 200, confirmando que o problema não é autenticação nem credenciais — é a resposta vazia do modelo preview.

A política do projeto (memória `core-model-and-reasoning-policy`) define **`openai/gpt-5.2`** como motor primário para tarefas complexas e **`gemini-2.5-flash`** como fallback estável. Modelos preview não devem ser usados em produção.

## Mudanças propostas

### 1. `supabase/functions/projeto-ia-assistant/index.ts`
- Trocar o modelo padrão de `google/gemini-3-flash-preview` para **`google/gemini-2.5-flash`** (estável, suporta tool calling robusto, menor custo).
- Adicionar **retry automático com fallback** para `openai/gpt-5-mini` quando o primeiro modelo não devolver `tool_calls`.
- Melhorar a mensagem de erro retornada ao frontend (mostrar status HTTP do gateway quando aplicável).

### 2. `supabase/functions/importar-briefing-ia/index.ts`
- Trocar o modelo de `google/gemini-3-flash-preview` para **`google/gemini-2.5-flash`**.
- Adicionar fallback para `openai/gpt-5-mini` se o tool call falhar.
- Logar a resposta crua quando `tool_calls` estiver ausente, para debug futuro.

### 3. Auditoria preventiva
- Buscar com `rg "gemini-3-flash-preview"` em todo `supabase/functions/` e listar quais outras funções usam o modelo preview, para o usuário decidir se quer migrar todas em lote (não vou alterar sem autorização adicional).

### 4. Testar
- Após o deploy, chamar `projeto-ia-assistant` via `curl_edge_functions` com `action: generate_checklist` para confirmar resposta válida.
- Verificar logs com `edge_function_logs`.

## Não inclui
- Não vou trocar o modelo de funções não relacionadas (ex: análise de fotos, conciliação) sem o usuário confirmar.
- Não vou mudar a UI dos botões.
- Não vou alterar a estrutura do banco de dados.

## Resultado esperado
Os três botões voltam a funcionar de forma estável, com fallback automático caso o modelo primário falhe. Mensagens de erro mais claras quando o problema for crédito (402) ou rate limit (429).
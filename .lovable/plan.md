# Copiloto fora do ar — causa identificada e correção

## O que está acontecendo

O copiloto responde com erro para os usuários porque o modelo de IA escolhido para
perguntas "pesadas" (resumo, análise, replanejamento, riscos, cronograma) não é aceito
pelo canal de chat usado pela aplicação.

Evidência nos logs do copiloto de projeto (2026-08-05 16:15:48Z):

```text
[ai-gateway] 400 em openai/gpt-5.5-pro:
"model is not a chat model; use /v1/responses ..."
```

Isso atinge exatamente os atalhos que aparecem na tela ("Resumo do projeto",
"Replanejar 2 semanas", "PDF: análise dos documentos"), porque todos contêm palavras
que ativam o roteamento para esse modelo.

Agravante: o mecanismo de fallback automático só age em erros de limite de uso (429) e
de crédito (402). Um erro 400 encerra a requisição sem tentar outro modelo, então o
usuário sempre vê falha.

O mesmo roteamento existe nos copilotos Central e Pedidos, logo eles têm o mesmo defeito
latente.

Não há indício de bloqueio por permissão: o problema é de configuração de modelo.

## Correção proposta

1. Trocar o modelo de raciocínio pesado dos copilotos por um modelo suportado no canal
   de chat atualmente usado (Projeto, Central, Pedidos). Manter o modelo padrão atual
   para perguntas simples.
2. Tornar o fallback resiliente: quando o gateway responder 400 por "modelo não é de
   chat", cair automaticamente para o próximo modelo da cadeia em vez de falhar.
3. Limpar a cadeia de fallback, removendo modelos que não funcionam nesse canal.
4. Melhorar a mensagem ao usuário quando o copiloto realmente falhar, em vez de erro
   genérico.
5. Validar com uma chamada real em cada copiloto (pergunta simples e pergunta de
   análise) e conferir os logs.
6. Registrar a versão do aplicativo e a memória do projeto com a regra de modelos
   permitidos por canal, para não reintroduzir o problema.

## Detalhes técnicos

- `supabase/functions/projeto-copilot/index.ts` (`escolherModelo`, ~linha 528):
  `openai/gpt-5.5-pro` -> modelo suportado em `/v1/chat/completions`.
- `supabase/functions/central-copilot/index.ts` (~linha 542) e
  `supabase/functions/pedidos-copilot/index.ts` (~linha 399): mesma troca.
- `supabase/functions/_shared/ai-gateway-call.ts`:
  - remover `openai/gpt-5.5-pro` e `openai/gpt-5.4-pro` da `FALLBACK_CHAIN`
    (só existem na Responses API);
  - tratar `400` com mensagem `is not a chat model` como caso de fallback,
    com log explícito.
- Deploy das funções afetadas e bump de `APP_VERSION` em `src/lib/version.ts`.

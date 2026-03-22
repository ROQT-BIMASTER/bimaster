

# Teste Completo de Endpoints + Chat de Suporte por Endpoint

## Parte 1: Teste e Correção de Endpoints

### Status atual dos testes (via edge function logs)

Todos os `/status` foram verificados e estão respondendo corretamente, incluindo as 6 funções corrigidas na iteração anterior (`contas-correntes-api`, `lancamentos-cc-api`, `orcamentos-caixa-api`, `contas-pagar-api`, `contas-receber-api`, `contas-pagar-export-api`).

### Teste end-to-end de cada fluxo CRUD

Para garantir 0% de quebra, executarei chamadas `curl` reais via `supabase--curl_edge_functions` em cada endpoint documentado, validando:
- Health check (`/status`) — 200 OK
- Auth rejeitada (sem header) — 401
- Operações CRUD com payloads de teste — verificação de response format
- Rate limit headers presentes

**APIs a testar (28 edge functions do portal):**

| Módulo | APIs |
|---|---|
| Geral | clientes, empresas, departamentos, categorias, projetos, parcelas |
| Auxiliares | tipos-atividade, tipos-anexo, tipos-entrega, tipos-documento, cnae, cidades, paises, bancos, bandeiras, origens, finalidades-transferencia, dre-cadastro |
| Finanças | contas-pagar, contas-receber, boletos, contas-correntes, lancamentos-cc, contas-pagar-export, orcamentos-caixa, pesquisar-lancamentos, movimentos-financeiros, resumo-financeiro |
| Complementar | anexos, webhook-inbound, webhook-dispatcher, webhook-subscriptions |

### Correções previstas
- Qualquer endpoint que retorne erro inesperado será corrigido no `index.ts` da função
- Flowcharts (`flow`) já estão definidos em todos os endpoints — verificar que nenhum ficou sem

---

## Parte 2: Chat de Suporte por Endpoint

### Conceito
Dentro de cada `EndpointCard` expandido, adicionar um botão "Dúvida sobre este endpoint?" que abre um mini-chat inline. A empresa terceira escreve sua dúvida, que fica salva no banco vinculada ao endpoint e API. O admin recebe e responde dentro do portal.

### Database — Nova tabela `api_support_messages`

```sql
CREATE TABLE public.api_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id text NOT NULL,           -- ex: 'contas-pagar'
  endpoint_path text NOT NULL,    -- ex: 'POST /incluir'
  empresa_id text,                -- empresa que perguntou
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  message text NOT NULL,
  is_admin_reply boolean DEFAULT false,
  admin_user_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'open',     -- open, answered, closed
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON api_support_messages 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON api_support_messages 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_full" ON api_support_messages 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_support_api ON api_support_messages(api_id, endpoint_path);
CREATE INDEX idx_support_status ON api_support_messages(status) WHERE status = 'open';
```

### Frontend — Componente `EndpointSupportChat`

Adicionado dentro do `EndpointCard` (abaixo do response):
- Botão discreto "💬 Dúvida sobre este endpoint?"
- Ao clicar, expande um mini-chat com:
  - Lista de mensagens existentes (perguntas + respostas do admin)
  - Campo de texto + botão enviar
  - Badge com contagem de mensagens abertas
- Admin vê todas as mensagens e pode responder inline
- Usa `supabase.from("api_support_messages")` para CRUD

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `api_support_messages` |
| `src/components/erp/EndpointSupportChat.tsx` | Criar — componente de chat inline |
| `src/components/erp/ApiDocumentation.tsx` | Integrar chat no `EndpointCard` |
| 28 Edge Functions | Testar via curl, corrigir se necessário |


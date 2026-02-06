

## Correção: Cadastro de PDV com IA não funciona

### Problema Identificado

A função backend `analisar-planilha-ia` **não está deployada** no servidor. Quando o app tenta chamá-la, recebe um erro 404 ("Function not found"), que se manifesta como "Failed to fetch" na tela.

### Causa Raiz

A função existe no código-fonte mas não foi deployada com sucesso na última atualização. Isso pode ter ocorrido por um problema de sincronização durante os deploys anteriores.

### Plano de Correção

**1. Ajustar configuração da função (`supabase/config.toml`)**

Alterar `verify_jwt` de `true` para `false` na função `analisar-planilha-ia`. A função já implementa sua propria autenticacao manualmente no codigo (verifica o token do usuario via `supabase.auth.getUser()`), entao o `verify_jwt = true` causa um conflito desnecessario que pode bloquear requisicoes validas.

**2. Atualizar cabeçalhos CORS da função**

Adicionar os headers extras do Supabase client no `corsHeaders` para evitar bloqueios de CORS em navegadores mais restritivos:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

**3. Fazer redeploy da função**

Deployar a funcao `analisar-planilha-ia` para que ela fique disponivel novamente no backend.

**4. Testar a função**

Chamar a funcao diretamente para verificar que esta funcionando corretamente apos o deploy.

### Arquivos Modificados

- `supabase/config.toml` - Alterar `verify_jwt` para `false`
- `supabase/functions/analisar-planilha-ia/index.ts` - Atualizar CORS headers


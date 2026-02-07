

# Auditoria Completa: Seguranca e Performance

## Problemas Encontrados

Apos analise exaustiva do codigo, banco de dados e logs, identifiquei **12 problemas** que precisam de correcao para passar numa auditoria, organizados por severidade.

---

## CRITICO - Seguranca

### 1. Edge Functions chamadas com chave anonima em vez de JWT do usuario

**Arquivos afetados:** `ContasPagarAIChat.tsx`, `SofiaFloatingChat.tsx`, `AIAnalyticsPanel.tsx`, `ElevenLabsStudio.tsx`, `useQAAgent.ts`

Estes componentes chamam edge functions usando `Authorization: Bearer VITE_SUPABASE_PUBLISHABLE_KEY` (chave publica anonima) em vez do token JWT do usuario autenticado. Isso significa que:
- As edge functions nao conseguem identificar quem esta fazendo a requisicao
- Qualquer pessoa com a chave publica pode chamar essas funcoes
- Logs de auditoria nao registram o usuario correto

**Correcao:** Obter o token da sessao do usuario via `supabase.auth.getSession()` e usar como Authorization bearer.

### 2. SignupForm.tsx ainda contem Google OAuth ativo

Segundo a politica do sistema, o signup publico foi desabilitado e Google OAuth foi removido. Porem o `SignupForm.tsx` ainda contem:
- `handleGoogleSignup()` com `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Formulario completo de cadastro publico
- Botao "Continuar com Google"

Embora a rota `/auth/signup` redirecione para login, o componente ainda e importavel e poderia ser usado se alguem revertesse o redirect.

**Correcao:** Limpar o SignupForm removendo Google OAuth e o formulario publico, mantendo apenas um aviso de "Acesso restrito".

### 3. Findings de seguranca pendentes no scan

O scan mostra 2 findings nao resolvidos:
- `contas_pagar_financial_exposure` (error) - A tabela `contas_pagar` usa `check_user_access` que pode ser amplo demais
- `financial_payment_queue_exposure` (warn) - Ja foi corrigido na migracao anterior, precisa ser deletado/atualizado no scanner

**Correcao:** Verificar e atualizar o status dos findings no scan de seguranca.

---

## ALTO - Performance

### 4. queryClient.clear() a cada 5 minutos destroi todo o cache

Em `App.tsx` (linha 437), um `setInterval` executa `queryClient.clear()` a cada 5 minutos. Isso remove **TODAS** as queries do cache, incluindo queries ativas que estao sendo exibidas na tela. Consequencias:
- Componentes perdem dados e fazem refetch desnecessario
- Flash de loading state a cada 5 minutos
- Perda total do beneficio do staleTime de 5 minutos configurado
- Experiencia do usuario degradada

**Correcao:** Substituir por `queryClient.removeQueries({ type: 'inactive' })` que remove apenas queries que nao estao sendo usadas ativamente.

### 5. Photo Queue Processor roda incondicionalmente

Em `main.tsx`, `startPhotoQueueProcessor()` inicia imediatamente ao carregar a pagina e chama a edge function `trigger-photo-queue` a cada 2 minutos, mesmo quando:
- O usuario nao esta autenticado
- O usuario nao tem acesso ao modulo de Trade
- Nao ha fotos na fila

**Correcao:** Mover o processador para dentro do contexto autenticado, iniciando apenas apos login e apenas para usuarios com permissao ao modulo trade.

### 6. PermissionsContext chama supabase.auth.getUser() (requisicao de rede)

O `PermissionsContext` chama `supabase.auth.getUser()` que faz uma requisicao HTTP ao servidor de auth. Poderia usar o `session.user` ja disponivel no `AuthContext` que esta em memoria.

**Correcao:** Receber o userId do AuthContext em vez de fazer chamada de rede adicional.

---

## MEDIO - Qualidade de Codigo

### 7. Rotas duplicadas em App.tsx

Existem 2 rotas duplicadas:
- Linha 246 e 247: `/dashboard/relatorios` (duplicada)
- Linha 342 e 343: `/dashboard/fabrica/ordens-producao` (duplicada)

Rotas duplicadas podem causar comportamento imprevisivel no React Router.

**Correcao:** Remover as linhas duplicadas (247 e 343).

### 8. 1024+ console.log em producao

O sistema tem um Logger estruturado (`logger.ts`) mas 56 arquivos ainda usam `console.log` diretamente, resultando em 1024+ chamadas que:
- Vazam informacoes de debug em producao
- Poluem o console do navegador
- Podem expor dados sensiveis (IDs de usuario, dados de sessao)

**Correcao:** Substituir os console.log mais criticos (em componentes de auth e dados financeiros) pelo logger estruturado. Os demais podem ser tratados progressivamente.

### 9. Catch blocks vazios

Em `AIAnalyticsPanel.tsx`, existem `catch (e) {}` vazios que engolem erros silenciosamente, dificultando debug em producao.

**Correcao:** Adicionar tratamento minimo (log ou ignorar explicitamente com comentario).

---

## BAIXO - Melhorias

### 10. MemoryMonitor e MemoryManager com funcionalidade sobreposta

O sistema tem dois sistemas separados fazendo a mesma coisa:
- `memory-monitor.ts` - verifica memoria a cada 30s
- `memory-manager.ts` - limpa cache a cada 3 min + limpeza no visibility change
- `App.tsx` - limpa queryClient a cada 5 min

Tres sistemas de limpeza competindo entre si.

**Correcao:** Consolidar em um unico sistema, removendo a limpeza agressiva do `queryClient.clear()`.

### 11. Realtime channel no PermissionsContext nao faz cleanup adequado

O canal realtime criado dentro do `.then()` retorna uma funcao de cleanup, mas essa funcao nao e capturada pelo useEffect cleanup. O canal pode ficar aberto apos o componente desmontar.

**Correcao:** Capturar a referencia do canal e fazer cleanup no return do useEffect.

### 12. useSupabaseQuery com configuracoes conflitantes

O hook `useSupabaseQuery.ts` define `staleTime: 5000` (5 segundos) mas o QueryClient global define `staleTime: 5 * 60 * 1000` (5 minutos). Isso cria inconsistencia: queries usando o hook customizado refetcham muito mais frequentemente.

**Correcao:** Alinhar o staleTime do hook com o global ou documentar a diferenca intencional.

---

## Secao Tecnica - Implementacao

### Arquivos a modificar

| Arquivo | Correcao |
|---------|----------|
| `src/components/financeiro/ContasPagarAIChat.tsx` | Usar JWT do usuario |
| `src/components/financeiro/SofiaFloatingChat.tsx` | Usar JWT do usuario |
| `src/components/ai/AIAnalyticsPanel.tsx` | Usar JWT do usuario |
| `src/components/marketing/ElevenLabsStudio.tsx` | Usar JWT do usuario |
| `src/hooks/useQAAgent.ts` | Usar JWT do usuario |
| `src/components/auth/SignupForm.tsx` | Remover Google OAuth |
| `src/App.tsx` | Remover rotas duplicadas + fix queryClient.clear |
| `src/main.tsx` | Condicionar photo processor a auth |
| `src/hooks/useSupabaseQuery.ts` | Alinhar staleTime |
| `src/contexts/PermissionsContext.tsx` | Fix channel cleanup + usar session |

### Migracao SQL

Nenhuma migracao de banco necessaria - as correcoes sao todas no frontend.

### Atualizacao dos findings de seguranca

Apos as correcoes, atualizar o scan para refletir os problemas resolvidos.

### O que NAO sera alterado

- Nenhuma funcionalidade existente sera modificada
- Nenhuma tela ou fluxo visual sera alterado
- Nenhuma tabela de banco sera modificada
- Nenhuma edge function sera modificada
- As permissoes e RLS policies permanecem inalteradas




## Plano: Auto-logout por Inatividade de 2 Horas

### Abordagem

Criar um hook isolado `useInactivityTimeout` e um modal de aviso `InactivityModal`, ambos **separados** do `AuthContext.tsx` para minimizar risco em produção. O `AuthContext` permanece inalterado -- o hook apenas consome `useAuth()` e chama `signOut` quando necessário.

### Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useInactivityTimeout.ts` | NOVO: hook que monitora atividade e dispara logout |
| `src/components/auth/InactivityModal.tsx` | NOVO: modal de aviso 5 min antes do logout |
| `src/components/dashboard/DashboardLayout.tsx` | Adicionar hook + modal (2 linhas) |

### Detalhes Técnicos

**Hook `useInactivityTimeout`:**
- Timer de **2 horas** (120 min) de inatividade
- Eventos monitorados: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll` -- com throttle de 30s para evitar overhead
- Aos **115 min** (5 min antes): ativa estado `showWarning` com contagem regressiva
- Aos **120 min**: executa `supabase.auth.signOut()`, limpa caches, redireciona para `/auth/login`
- Registra evento `session_timeout` no `access_audit_log`
- Timer **pausa quando a aba está oculta** (`visibilitychange`) para não deslogar quem alternou de aba e voltou dentro do prazo
- Cleanup completo no unmount (todos os listeners e intervals removidos)

**Modal `InactivityModal`:**
- Dialog simples com contagem regressiva (mm:ss)
- Botão "Continuar Sessão" que reseta o timer
- Usa componentes existentes (Dialog, Button) -- zero dependência nova

**Integração no `DashboardLayout`:**
- Apenas 2 adições: import do hook/modal e renderização condicional
- Sem alterar `AuthContext.tsx` (zero risco de quebra no fluxo de autenticação)

**Proteção contra erros em produção:**
- Hook usa `try/catch` em todo signOut e audit log
- Se o insert no audit falhar, o logout prossegue normalmente
- Se o signOut falhar, faz fallback com `navigate("/auth/login")`
- Não altera nenhum estado do `AuthContext` diretamente


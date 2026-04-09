

# Trilha de Auditoria de Tokens ERP

## Problema
Os tokens criados no Portal ERP nao registram nenhuma atividade de uso. A tabela `api_security_log` existe mas possui 0 registros. Nao ha como o administrador identificar quem esta usando cada token, de qual IP, qual endpoint, com que frequencia, ou detectar uso malicioso.

## Solucao

### 1. Logging automatico em cada chamada de API (backend)

Modificar `supabase/functions/_shared/auth.ts` — na funcao `validateAnyAuth` — para registrar cada uso de token na tabela `api_security_log` automaticamente. Como todas as 36 APIs ERP passam por essa funcao, a cobertura sera de 100% sem precisar editar cada API individualmente.

Dados registrados por chamada:
- Endpoint chamado
- Metodo HTTP (GET, POST, PUT, DELETE)
- IP de origem
- User-Agent
- Se usou API Key ou JWT
- Sucesso ou falha
- Tempo de resposta (aproximado)
- `key_preview` do token usado (para rastreabilidade sem expor a chave)

O logging sera fire-and-forget (nao bloqueia a resposta da API).

### 2. Componente de Trilha de Auditoria (frontend)

Criar `src/components/erp/ApiTokenAuditTrail.tsx` — visivel apenas para administradores.

Funcionalidades:
- **Tabela de logs** com colunas: Data/Hora, Token (preview), Endpoint, Metodo, IP, Status, Tempo
- **Filtros**: Por token especifico, por periodo, por endpoint, por status (sucesso/erro)
- **Indicadores de anomalia**:
  - IP diferente do habitual para aquele token (alerta visual)
  - Volume anormal de requisicoes (pico > 3x media)
  - Tentativas com tokens invalidos/expirados
- **Cards de resumo**: Total de chamadas (24h), Tokens ativos, Erros, IPs unicos
- **Grafico**: Volume de chamadas por hora (ultimas 24h)

### 3. Integracao na pagina do Portal ERP

Adicionar uma nova aba "Auditoria" no `IntegracaoERP.tsx`, visivel apenas quando `isAdmin === true`, posicionada entre "Portal" e "Configuracoes".

### 4. Registro de falhas de autenticacao

Modificar `validateAnyAuth` para tambem registrar tentativas com tokens invalidos — essencial para detectar ataques de forca bruta ou tokens comprometidos.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/_shared/auth.ts`
- Adicionar funcao `logApiAccess()` que insere na tabela `api_security_log`
- Chamar no retorno bem-sucedido e no catch de `validateAnyAuth`
- Fire-and-forget: `logApiAccess(...).catch(() => {})` — nao afeta performance

### Arquivo: `src/components/erp/ApiTokenAuditTrail.tsx` (novo)
- Query na tabela `api_security_log` com filtros dinamicos
- Deteccao de anomalias no frontend (comparacao de IPs por token)
- Paginacao (50 registros por vez)
- Refresh automatico a cada 30 segundos

### Arquivo: `src/pages/IntegracaoERP.tsx`
- Nova aba "Auditoria" condicional a `isAdmin`
- Import do componente `ApiTokenAuditTrail`

### RLS
A tabela `api_security_log` ja existe. Verificar se possui RLS habilitado e adicionar politica de leitura restrita a administradores.

## Resumo

| Componente | Arquivo | Tipo |
|-----------|---------|------|
| Logging centralizado | `_shared/auth.ts` | Edicao |
| UI de auditoria | `ApiTokenAuditTrail.tsx` | Novo |
| Aba no portal | `IntegracaoERP.tsx` | Edicao |
| RLS da tabela de logs | Migration | Novo |




# Defesa Contra Ataques Distribuídos — Detecção por Subnet + Auto-Bloqueio

## Diagnóstico

O Sentinel detectou corretamente um ataque distribuído: **77 IPs distintos, 183 falhas em 12 minutos**, todos de subnets AWS (15.228.x, 18.231.x, 56.125.x, 54.233.x). Nenhum IP individual ultrapassa o limiar de bloqueio (5-6 falhas cada), mas coletivamente é um ataque coordenado claro.

**Gap atual**: O Sentinel analisa IPs individualmente. Não existe detecção por subnet/CIDR nem correlação temporal de ataques distribuídos.

## Solução

### 1. Detecção de Ataques Distribuídos no Sentinel (Backend)

**Arquivo**: `supabase/functions/security-ai-sentinel/index.ts`

Adicionar lógica de agregação por subnet (/16) antes de enviar ao modelo IA:
- Agrupar IPs por prefixo (ex: `18.231.x.x`)
- Calcular métricas por subnet: IPs únicos, falhas totais, endpoints únicos, janela temporal
- Novo tipo de anomalia: `DISTRIBUTED_SCANNING` — acionado quando um subnet tem 5+ IPs com falhas simultâneas
- Incluir dados de subnet no prompt da IA para melhor análise
- Nova ação de defesa: `block_subnet` — bloqueia todos os IPs conhecidos de um subnet atacante

Quando a IA retorna `block_subnet` com confidence >= 0.7 (limiar mais baixo que individual, pois a correlação de subnet já é forte evidência):
- Inserir todos os IPs do subnet na `security_ip_blocklist` com bloqueio soft (24h)
- Registrar incidente com tipo `DISTRIBUTED_SCANNING`

### 2. Alerta Visual de Ataque Distribuído (Frontend)

**Arquivo**: `src/components/erp/ApiSecurityDashboard.tsx`

Adicionar seção de detecção de ataques distribuídos:
- Banner de alerta vermelho quando detectar 3+ IPs do mesmo subnet com falhas
- Tabela de subnets suspeitos: prefixo, IPs únicos, falhas, endpoints alvos
- Botão "Bloquear Subnet" para ação manual do admin

### 3. Painel Sentinel — Exibir Ataques Distribuídos

**Arquivo**: `src/components/erp/SecuritySentinelPanel.tsx`

- Exibir anomalias do tipo `DISTRIBUTED_SCANNING` com visual diferenciado (ícone de rede)
- Mostrar lista de IPs do subnet no detalhe da anomalia
- Exibir ação `block_subnet` com contagem de IPs bloqueados

## Detalhes Técnicos

### Lógica de Agrupamento por Subnet

```text
IP 18.231.113.137 → prefix "18.231"
IP 18.231.167.150 → prefix "18.231"
IP 18.231.94.236  → prefix "18.231"
→ Subnet 18.231.x.x: 10 IPs, 25 falhas, 5 endpoints
→ ALERTA: Ataque distribuído detectado
```

### Limiar de Detecção
- Subnet com **5+ IPs distintos** com falhas em janela de **2 horas** = `DISTRIBUTED_SCANNING`
- Confidence base: 0.7 (ajustável pela IA com base no padrão)

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `security-ai-sentinel/index.ts` | Agregar por subnet, novo tipo anomalia, ação block_subnet |
| `ApiSecurityDashboard.tsx` | Banner de ataque distribuído, tabela de subnets |
| `SecuritySentinelPanel.tsx` | Visual para DISTRIBUTED_SCANNING |

Nenhuma migração de banco necessária.


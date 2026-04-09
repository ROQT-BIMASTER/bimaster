

# Bloqueio Hard de Todos os IPs dos 8 Subnets Atacantes

## Situacao Atual

- **189 IPs** ja na blocklist, todos como `block_level: soft` (rate limiting agressivo, mas nao bloqueio total)
- **24 IPs** dos subnets atacantes ainda NAO estao bloqueados
- O ataque e confirmado e coordenado — justifica bloqueio **hard** (rejeicao 403 total)

## Plano

### 1. Migration SQL — Bloquear tudo como Hard

Uma unica migration que:

1. **Upgrade**: Atualiza os 189 bloqueios existentes de `soft` para `hard`
2. **Insert**: Adiciona os 24 IPs faltantes como `hard`
3. **Periodo**: Bloqueio por 7 dias (expires_at = now() + 7 days) em vez de 24h

```sql
-- Upgrade existing soft blocks to hard
UPDATE security_ip_blocklist SET block_level = 'hard' WHERE block_level = 'soft';

-- Insert missing IPs from attacking subnets
INSERT INTO security_ip_blocklist (ip_address, block_level, blocked_by, reason, expires_at)
VALUES 
  ('15.228.45.7', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', now() + interval '7 days'),
  -- ... (24 IPs total)
ON CONFLICT (ip_address) DO UPDATE SET block_level = 'hard';
```

### 2. Nenhuma mudanca em codigo

O `secureHandler` ja integra o `securityCheck` que consulta a `security_ip_blocklist`. Bloqueios `hard` retornam 403 automaticamente.

## Resultado

- **213 IPs** bloqueados com rejeicao total (403 Forbidden)
- Cobertura completa dos 8 subnets: 56.124.x, 18.228.x, 15.229.x, 18.230.x, 56.125.x, 18.231.x, 54.233.x, 15.228.x
- Bloqueio valido por 7 dias

| Componente | Tipo |
|-----------|------|
| Migration SQL | Novo |


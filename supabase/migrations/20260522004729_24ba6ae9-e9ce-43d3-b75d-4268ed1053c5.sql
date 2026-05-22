-- Backfill: para todas as mensagens de tickets já resolvidos, propaga
-- resolvido_em no metadata para que o cronômetro do protocolo pare na UI.
UPDATE mensagens m
SET metadata = COALESCE(m.metadata, '{}'::jsonb)
             || jsonb_build_object('resolvido_em', to_char(t.resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
FROM suporte_tickets t
WHERE t.id = m.ticket_id
  AND t.resolved_at IS NOT NULL
  AND (m.metadata->>'resolvido_em') IS NULL
  AND (m.metadata->>'protocolo') IS NOT NULL;
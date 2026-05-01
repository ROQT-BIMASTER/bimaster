# Plano de Hardening Profundo de Segurança

## Status

- **Fase 1 (DB + Audit + Quarentena + SIEM base)**: CONCLUÍDA (v3.4.67)
- **Fase 2 (MFA TOTP + Step-up)**: CONCLUÍDA (v3.4.68)
- **Fase 3 (WAF v2 — Geo/ASN + Bot signals)**: Tabelas criadas (v3.4.68); engine de aplicação será integrada ao `_shared/waf.ts` em release seguinte
- **Fase 4 (CSP defesa em profundidade no cliente)**: CONCLUÍDA (v3.4.68)
- **Fase 5 (PII / LGPD)**: helpers `mask_cpf` e `mask_email` implementados (v3.4.68); aplicação em views/RLS de tabelas sensíveis fica como próximo passo
- **Fase 6 (SIEM correlation engine)**: CONCLUÍDA (v3.4.68)
- **Fase 7 (CI gates + DR)**: documentado abaixo

## Recovery Plan (Disaster Recovery)

- **RPO (Recovery Point Objective)**: 15 minutos — backups PITR Supabase contínuos
- **RTO (Recovery Time Objective)**: 1 hora — restore para projeto irmão e flip de DNS
- **Quarentena**: contas comprometidas podem ser bloqueadas em < 30s via `security-admin`
- **Hash chain audit**: integridade verificável a qualquer momento via `audit_log_verify_chain`

## Próximos passos sugeridos

1. Forçar `MfaGate` em rotas admin/financeiro (rollout gradual)
2. Aplicar `mask_cpf`/`mask_email` em views públicas de profiles
3. Integrar `waf_geo_policy` ao `_shared/waf.ts` (lookup MaxMind ou header `cf-ipcountry`)
4. Job cron diário invocando `siem-correlate` (via `pg_cron` + `net.http_post`)
5. Implementar criptografia de campo via `pgsodium` para `mfa_enrollments.secret_encrypted`

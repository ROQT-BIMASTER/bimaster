---
name: Hardening / risco identificado (não-vulnerabilidade)
about: Sugerir melhoria de postura de segurança que NÃO é uma vulnerabilidade explorável
labels: ["security", "hardening"]
---

> Para vulnerabilidades exploráveis (auth bypass, RCE, exfiltração, RLS leak),
> **NÃO** abra issue pública. Use Security Advisories:
> https://github.com/ROQT-BIMASTER/Roqt-Bimaster/security/advisories/new
> ou e-mail `seguranca@bimaster.online`.

## Categoria

- [ ] RLS / permissões / roles
- [ ] Segredos / rotação / exposição
- [ ] Dependências / supply chain
- [ ] CSP / headers / clickjacking
- [ ] Logs / auditoria / forense
- [ ] LGPD / PII / governança de dados
- [ ] Edge function / secureHandler
- [ ] Outro

## Descrição do risco

<!-- O que está exposto, por quê é problema, qual o cenário de abuso. -->

## Evidência

<!-- Linhas de código, queries, headers observados, screenshots. -->

## Correção proposta

<!-- Migration, policy, refactor, política. Inclua trade-offs. -->

## Severidade percebida

- [ ] Crítica — exploração direta com impacto financeiro / privacidade
- [ ] Alta — abuso requer condições adicionais
- [ ] Média — defense-in-depth
- [ ] Baixa — boa prática

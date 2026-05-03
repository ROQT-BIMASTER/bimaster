# Política de Segurança — Bi Master

## Reportar uma vulnerabilidade

Vulnerabilidades de segurança devem ser reportadas em caráter confidencial,
**não** via issues públicas no GitHub.

- **E-mail**: `seguranca@bimaster.online`
- **PGP** (opcional): solicitar chave pelo e-mail acima

Inclua, quando possível: descrição, passos de reprodução, impacto estimado,
versão/commit afetado e prova de conceito mínima.

Compromisso de resposta:

- Confirmação de recebimento em **2 dias úteis**
- Triagem inicial em **5 dias úteis**
- Plano de mitigação em **15 dias úteis** (severidade Crítica/Alta) ou
  **30 dias úteis** (Média/Baixa)

## Escopo

Aplicações em produção:

- `https://bimaster.lovable.app`
- `https://bimaster.online` e subdomínios
- Edge Functions hospedadas no backend Supabase do projeto

Fora de escopo: serviços de terceiros (Cloudflare, Supabase, OAuth providers),
ataques de engenharia social, DoS volumétrico.

## Documentação técnica

Postura de segurança, controles implementados e auditorias em
[`docs/security/`](./docs/security/README.md).

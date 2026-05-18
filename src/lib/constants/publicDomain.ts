/**
 * Domínio canônico para links públicos compartilháveis (formulários dinâmicos,
 * links de equipe com token, etc.).
 *
 * Sempre use estes helpers em vez de `window.location.origin` — caso contrário,
 * links gerados a partir de previews (*.lovable.app) ou outros domínios
 * técnicos vazariam para usuários finais.
 */
export const PUBLIC_FORMS_DOMAIN = "https://china.bimaster.online";

export const buildDynamicFormPublicUrl = (formId: string, token?: string) =>
  token
    ? `${PUBLIC_FORMS_DOMAIN}/formulario-dinamico?form=${formId}&token=${token}`
    : `${PUBLIC_FORMS_DOMAIN}/formulario-dinamico?form=${formId}`;

export const buildTeamFormTokenUrl = (token: string) =>
  `${PUBLIC_FORMS_DOMAIN}/formulario-equipe?token=${token}`;

## Contexto

O domínio `bimaster.online` (e o subdomínio `china.bimaster.online`) está sendo bloqueado pelo Microsoft Defender SmartScreen. Verifiquei:

- O site responde HTTP 200 normalmente, com HTTPS válido (Cloudflare/Lovable).
- Já existem headers de segurança aplicados: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Não há indicação técnica no código ou na infraestrutura de phishing/malware.

**Importante:** SmartScreen é um sistema de **reputação externa da Microsoft**. O bloqueio não é causado por código ou configuração do app — é uma marcação no banco de dados de reputação da Microsoft. Por isso, **nenhuma alteração de código no projeto resolve isso sozinha**. A correção exige uma ação manual de submissão para revisão no portal da Microsoft, complementada por reforço de sinais de confiança no domínio.

Causas comuns de marcação errônea para domínios novos ou TLDs alternativos (`.online`):
1. Domínio recém-registrado, baixa reputação histórica.
2. TLD `.online` é frequentemente associado a abuso e tem reputação base mais baixa.
3. Algum subdomínio anterior pode ter sido reportado.
4. Falta de páginas institucionais (Sobre, Privacidade, Contato) que SmartScreen usa como sinal.

## Plano de ação

### 1. Submissão de revisão ao Microsoft (ação humana — você executa)

Esta é **a ação principal e única que destrava o bloqueio**:

- Acessar: https://www.microsoft.com/en-us/wdsi/filesubmission/exdomains
- Categoria: **"I believe this URL has been incorrectly classified as malicious."**
- Submeter ambos: `https://bimaster.online` e `https://china.bimaster.online`
- Justificativa sugerida (em inglês — texto técnico):
  > "Legitimate B2B SaaS platform for cosmetics manufacturing operations (ERP, finance, project management). HTTPS-only, HSTS enforced, no user-generated public content, no downloads exposed to anonymous users. Hosted on Lovable platform behind Cloudflare. No phishing, malware, or abusive behavior. Please reclassify as safe."
- Repetir a submissão em https://safebrowsing.google.com/safebrowsing/report_error/ (alguns produtos Microsoft consomem o feed do Google Safe Browsing também).
- Tempo típico de re-análise: **24h–72h**.

### 2. Reforço de sinais de confiança (eu posso implementar no código)

Posso adicionar/garantir, no frontend do projeto, elementos que aumentam a credibilidade automática para crawlers de reputação:

a. **Página pública institucional mínima** em `/` (rota pública, sem auth):
   - Nome da empresa, descrição clara do produto.
   - Link para Política de Privacidade e Termos de Uso.
   - Contato (email corporativo + endereço).
   - Logo e identidade visual coerentes.

b. **Páginas legais públicas**:
   - `/privacidade` — política de privacidade LGPD-ready.
   - `/termos` — termos de uso.
   - `/contato` — formulário ou dados de contato.

c. **Metadados SEO completos** (`index.html`):
   - `<meta name="description">` claro e legítimo.
   - `<meta name="author">`, `<meta name="robots" content="index,follow">`.
   - Open Graph / Twitter Cards corretos.
   - JSON-LD `Organization` schema (nome legal, URL, logo, contato).

d. **`robots.txt` e `sitemap.xml`** públicos e bem-formados (sinal positivo para crawlers).

e. **`security.txt`** em `/.well-known/security.txt` (RFC 9116) — aumenta reputação.

### 3. Verificações adicionais (opcionais, recomendadas)

- Cadastrar o domínio no **Bing Webmaster Tools** (https://www.bing.com/webmasters) — Bing/Microsoft usa esses sinais diretamente para SmartScreen.
- Cadastrar no **Google Search Console** — espelho do Safe Browsing.
- Verificar se o domínio aparece em listas como VirusTotal (https://www.virustotal.com/) e contestar detecções individuais.

## Detalhes técnicos do que eu vou fazer no código

Arquivos a criar/editar:
- `index.html` — adicionar JSON-LD Organization, meta tags institucionais.
- `public/robots.txt` — permitir indexação.
- `public/sitemap.xml` — listar rotas públicas.
- `public/.well-known/security.txt` — contato de segurança.
- `src/pages/Privacidade.tsx`, `src/pages/Termos.tsx`, `src/pages/Contato.tsx` — páginas legais públicas (rotas em `App.tsx`).
- `src/pages/Landing.tsx` (ou similar, se ainda não existe) — landing pública institucional para usuários não autenticados em `/`.

## Resultado esperado

- **Curto prazo (eu implemento):** sinais técnicos de legitimidade reforçados; o site passa a ter conteúdo público institucional que crawlers de reputação reconhecem.
- **Médio prazo (você submete a revisão):** Microsoft remove o bloqueio em 24–72h após análise manual.

## O que **não** vou fazer

- Não vou alterar lógica de negócio, RLS, autenticação ou qualquer coisa fora do escopo de "presença pública e metadados".
- Não vou tocar em rotas autenticadas (`/dashboard/*`).

## Decisão sua antes de eu implementar

Confirme dois pontos:
1. **Razão social, email de contato e endereço** que devo usar nas páginas legais e no JSON-LD (ou se prefere placeholder genérico para você editar depois).
2. Se quer que eu crie/atualize uma **landing pública** em `/` (atualmente acho que `/` redireciona para `/auth` ou `/dashboard`), ou mantenho o redirect e crio só as páginas legais avulsas.

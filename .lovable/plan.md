# Passo a passo no painel DNS da IONOS

Diagnóstico atual (com base no print do painel + `dig`):

- `bimaster.online` (apex) → resolve para `188.114.96.2` (Cloudflare) — **errado**, está caindo em outro projeto (Vercel proxiado pela Cloudflare). É por isso que `https://bimaster.online/auth/login` mostra outra coisa.
- `www.bimaster.online` → resolve para `188.114.97.2` (Cloudflare) — **errado**, mesma situação.
- `china.bimaster.online` → resolve para `185.158.133.1` (Lovable) — **correto**.

Mas o painel da IONOS mostra que **já existem registros A apontando para `185.158.133.1`** para `@` e `www`. Ou seja: existem **registros duplicados/conflitantes** ou os nameservers da IONOS não estão sendo usados (o domínio pode estar com NS da Cloudflare). Por isso o que aparece no DNS público não bate com o que está cadastrado na IONOS.

---

## O que arrumar (fora da Lovable, no painel da IONOS)

### Passo 1 — Confirmar quem responde pelo DNS
Antes de mexer em qualquer registro, descobrir se o domínio está usando os nameservers da IONOS ou da Cloudflare:
- No painel IONOS, abrir **Domínios → bimaster.online → Nameservers**.
- Se estiver "Nameservers Cloudflare" (`*.ns.cloudflare.com`): **as alterações na tela de DNS da IONOS não têm efeito** — você precisa editar na Cloudflare em vez disso (ou voltar para os nameservers padrão da IONOS).
- Se estiver "Nameservers IONOS" (`ns*.ui-dns.*`): ótimo, o painel que você mandou print é o que vale. Seguir para o passo 2.

### Passo 2 — Limpar registros conflitantes do apex e do www
Na linha do tipo **"UM"** (que é como a IONOS traduz "A"):

- Linha `@ → 185.158.133.1` — **manter** (esta é a correta, aponta para a Lovable).
- Linha `www → 185.158.133.1` — **manter**.
- Qualquer outra linha A/AAAA/ALIAS/ANAME para `@` ou `www` apontando para outro IP (Cloudflare 188.114.x.x, Vercel, etc.) — **excluir**.
- Qualquer CNAME no `@` ou no `www` que não seja o `_domainconnect` — **excluir** (CNAME no apex não pode coexistir com A).

### Passo 3 — Garantir que os registros TXT de verificação da Lovable estão corretos
O print mostra:
- `_adorável → "lovable_verify=fe6b9516..."` → esse nome está com acento porque o painel está em português. O **valor real do registro é `_lovable`**, não `_adorável`. Isso é só rótulo da IONOS, está correto.
- `_adorável.www → "lovable_verify=04f2837e..."` → idem (`_lovable.www`), correto.

Não precisa mexer.

### Passo 4 — Não usar proxy/CDN externo no apex
Se em algum momento você ativou Cloudflare (ou outro proxy) para o apex `bimaster.online`, **desativar a "nuvem laranja"** (proxy) ou remover esse domínio da Cloudflare. A Lovable já provisiona SSL e CDN — se outro proxy ficar na frente, ele captura o tráfego e nunca chega na Lovable.

### Passo 5 — Aguardar propagação e revalidar
- DNS pode levar até 72h, mas costuma propagar em 5–30 min após o ajuste.
- Validar com:
  ```bash
  dig +short bimaster.online @1.1.1.1
  dig +short www.bimaster.online @1.1.1.1
  ```
  Os dois devem retornar **apenas** `185.158.133.1`.
- Depois rodar nosso scanner:
  ```bash
  bash scripts/security/hsts-subdomain-scan.sh
  ```

### Passo 6 — Reconectar o domínio na Lovable
Após o DNS apontar 100% para `185.158.133.1`:
- **Project Settings → Domains** → clicar em **Connect Domain**.
- Adicionar `bimaster.online` E `www.bimaster.online` (são entradas separadas).
- Definir um deles como **Primary** (recomendo `bimaster.online`); o outro fará 301 para o primário.
- A Lovable provisiona o SSL automaticamente em alguns minutos.

---

## O que NÃO precisa mexer
- Os registros **MX** (`mx00/mx01.ionos.com`) — são do email, deixar como está.
- Os **CNAMEs DKIM** (`s1-ionos`, `s2-ionos`, `s42582890`) — autenticação de email, manter.
- O **SPF** (`v=spf1 include:_spf-us.ionos.com ~all`) e o **DMARC** — manter.
- Os **NS `notificar`** — subdomínio delegado, não interfere no apex.
- O **CNAME `_domainconnect`** — usado pela IONOS para auto-setup, manter.
- O subdomínio `china.` — já está correto.

---

## Resumo curto (TL;DR)
1. Confirmar que os nameservers do `bimaster.online` são da **IONOS** (não Cloudflare).
2. Apagar qualquer registro A/CNAME no `@` ou `www` que **não** seja `185.158.133.1`.
3. Desativar qualquer proxy externo (Cloudflare laranja, Vercel, etc.) na frente do apex.
4. Aguardar propagação, validar com `dig`, e reconectar o domínio em **Project Settings → Domains** dentro da Lovable.

Depois disso, `https://bimaster.online/auth/login` vai servir este app.

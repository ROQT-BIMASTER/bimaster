

## Portas TCP 8080 e 8443 — Análise

### Situação

As portas 8080 e 8443 detectadas pelo Nmap **não são controláveis pelo código da aplicação**. Elas são gerenciadas pela infraestrutura do Lovable Cloud / Cloudflare, que hospeda o projeto.

- **Porta 8080**: Proxy HTTP alternativo (usado internamente pelo Lovable para servir o preview/build)
- **Porta 8443**: Proxy HTTPS alternativo (mesmo propósito, versão segura)

### Por que não podemos fechar

1. **Sem acesso ao firewall**: O Lovable Cloud não expõe configuração de firewall ou regras de rede ao usuário
2. **Portas da plataforma**: São usadas pela própria infraestrutura de hosting — fechá-las quebraria o deploy
3. **Cloudflare gerencia**: O tráfego passa pelo Cloudflare, que usa essas portas como parte do seu proxy reverso

### Recomendação

**Aceitar o risco** nestes dois findings do Nmap. As portas 8080 e 8443 são portas padrão do Cloudflare e servem o mesmo conteúdo que 80/443, com as mesmas proteções (TLS, headers de segurança, WAF do Cloudflare).

Não há ação de código ou configuração possível neste projeto para resolver isso. Seria necessário contato direto com o suporte do Lovable para solicitar bloqueio dessas portas, caso fosse realmente necessário.

### Score Consolidado Atualizado

| Scan | Status | Ação |
|------|--------|------|
| SSLyze | ✅ Limpo | — |
| Nmap UDP | ✅ Limpo | — |
| Nmap TCP (8080/8443) | ⚠️ Médio | **Aceitar risco** (infraestrutura da plataforma) |
| Nuclei | ✅ Limpo | — |
| ZAP - Clickjacking | ✅ Corrigido | CSP `frame-ancestors` adicionado |
| ZAP - CSP ausente | ✅ Corrigido | CSP completo adicionado |
| ZAP - SRI ausente | ✅ Corrigido | Fontes hospedadas localmente |


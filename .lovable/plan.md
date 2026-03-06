

## Correção: Atributo de Integridade de Subrecurso Ausente (CWE-345)

### Problema
O ZAP detectou que os links para Google Fonts no `index.html` não possuem o atributo `integrity` (SRI — Subresource Integrity), permitindo que um atacante com acesso ao servidor externo injete conteúdo malicioso.

### Limitação Importante
Google Fonts **não suporta SRI** porque o conteúdo CSS retornado varia conforme o User-Agent do navegador (fontes diferentes para Chrome, Firefox, Safari). Isso significa que o hash muda a cada requisição, tornando SRI inviável.

### Solução Recomendada
Hospedar as fontes localmente em vez de carregá-las de um CDN externo. Isso:
1. Elimina a dependência de servidor externo (resolve CWE-345)
2. Melhora performance (sem DNS lookup extra)
3. Melhora privacidade (sem requests para Google)

### O que será feito

| Ação | Detalhe |
|------|---------|
| Baixar fontes | Inter (300-700) e Plus Jakarta Sans (400-800) em formato woff2 |
| Criar CSS local | `src/styles/fonts.css` com `@font-face` declarations |
| Adicionar arquivos | Fontes em `public/fonts/` |
| Editar `index.html` | Remover links para `fonts.googleapis.com` e `fonts.gstatic.com` |
| Editar CSP | Remover `fonts.googleapis.com` e `fonts.gstatic.com` das diretivas CSP |
| Importar CSS | Importar `fonts.css` no `main.tsx` ou `index.css` |

Isso resolve completamente a vulnerabilidade CWE-345 nas 3 instâncias reportadas.


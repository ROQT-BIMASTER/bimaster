

# Plano para Nota 10/10 — Gaps Finais

## Nota Atual: 9.9/10 | Dev Junior sem suporte: ~95%

O sistema já está extremamente completo. Restam **3 gaps cirúrgicos** para atingir 10/10:

## Gap 1 — SDK sem tipos TypeScript (+0.05)

O SDK JS é gerado como `.js` puro sem tipagem. Um dev junior usando TypeScript não terá autocomplete nem validação de campos. Falta gerar um arquivo `.d.ts` ou converter o SDK para `.ts` nativo com interfaces tipadas para cada endpoint (ex: `CpIncluirPayload`, `CrListarResponse`).

**Arquivo:** `src/components/erp/SdkDownloadButtons.tsx`
- Converter `generateJsSDK()` para gerar TypeScript com interfaces tipadas para todos os payloads e respostas
- Adicionar botão "Download SDK TypeScript (.ts)" separado do JS

## Gap 2 — Wizard testa via sandbox, não com a key real (+0.03)

O passo 2 do wizard chama `api-sandbox` (simulação), não testa se a API Key do usuário funciona de verdade em produção. O dev pode concluir o onboarding achando que está tudo certo, mas falhar na primeira chamada real.

**Arquivo:** `src/components/erp/ApiOnboardingWizard.tsx`
- Passo 2: além do teste sandbox, fazer uma chamada real `GET /contas-pagar-api/status` com o header `x-api-key` preenchido pelo usuário
- Mostrar resultado diferenciado: "Sandbox OK" vs "Produção OK"

## Gap 3 — OpenAPI/Swagger spec para download (+0.02)

Existe Postman Collection, mas não há OpenAPI 3.0 spec. Ferramentas como Swagger UI, Insomnia, e geradores de código dependem de OpenAPI. Adicionar geração automática de `openapi.json` a partir das definições existentes.

**Arquivo:** `src/components/erp/ApiDocumentation.tsx`
- Adicionar função `generateOpenAPISpec()` que converte os `ApiModule[]` existentes para OpenAPI 3.0
- Botão "Download OpenAPI Spec" ao lado do Postman Collection

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | SDK TypeScript tipado com interfaces |
| `src/components/erp/ApiOnboardingWizard.tsx` | Teste real com API Key em produção |
| `src/components/erp/ApiDocumentation.tsx` | Gerar OpenAPI 3.0 spec para download |

## Nota Projetada

| Critério | Antes | Depois |
|---|---|---|
| SDKs | 9.0 | 10.0 |
| Onboarding | 9.5 | 10.0 |
| Documentação | 9.8 | 10.0 |
| **Nota Global** | **9.9** | **10.0/10** |
| **Dev Junior integrar sem suporte** | **~95%** | **~98%** |

Os 2% restantes são inerentes — conceitos financeiros (DRE, conciliação bancária) que exigem conhecimento de domínio além da documentação técnica.




# Adicionar Etapa de Aprovação Brasil no Diagrama de Concepção

## Problema
O diagrama atual pula de "China recebe demanda" direto para a Fase de Execução. Falta a etapa crítica: **China envia documentos/amostras de volta → Brasil faz Checklist e conferência → Libera para produção**.

## Solução
Expandir o diagrama da Fase 1 (Concepção) para incluir o fluxo de retorno e aprovação, e atualizar os bullet points.

### Arquivo: `src/pages/RelatorioDesenvolvimento.tsx` (linhas 195-206)

**Diagrama atualizado** — após "CN China recebe demanda", adicionar:

```text
  │  🇨🇳 China recebe    │
  │  demanda e produz   │
  │  amostras           │
  └──────────┬──────────┘
             │
             ▼
  ┌──────────────────────┐
  │ 🇨🇳 China envia docs │
  │ e amostras para      │
  │ aprovação Brasil     │
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ 🇧🇷 Brasil confere   │
  │ ✅ Checklist         │
  │ 📋 Docs + Produto   │
  │ 🔒 Libera produção  │
  └──────────────────────┘
```

**Bullet points atualizados:**
- Equipe Brasil identifica oportunidade (viagem à China, pesquisa, demanda comercial)
- Submissão registrada no sistema com dados do produto desejado
- China recebe a demanda e produz amostras/protótipos
- **China envia documentos e amostras para aprovação do Brasil**
- **Brasil confere via Checklist: documentos, produto físico e conformidade**
- **Produção só é liberada após aprovação formal do Brasil**
- Briefing IA gerado por tarefa com dados estruturados

### Impacto
- 1 arquivo, 1 trecho modificado
- Torna explícito o portão de aprovação Brasil antes da produção


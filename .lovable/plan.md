

# Atualizar Relatório: Produção = China + OC + Acompanhamento

## Problema
O diagrama atual termina em "Libera produção" sem detalhar o que acontece depois. Na realidade, após a aprovação do Brasil:
1. **Ordem de Compra (OC)** é emitida para a fábrica na China
2. **China produz** e reporta avanço (apontamentos de produção)
3. **Embarque** é registrado quando a produção finaliza

O sistema já tem o módulo `china_ordens_compra` com fluxo completo (rascunho → aprovada → em produção → embarque). O relatório precisa documentar isso.

## Alterações

### 1. Diagrama da Fase 1 (Concepção) — após "Libera produção"
Adicionar bloco de OC e acompanhamento no diagrama ASCII:

```text
  │ 🔒 Libera produção  │
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ 🇧🇷 Emite Ordem de   │
  │ Compra (OC) p/ China │
  │ OC-2026-001          │
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │ 🇨🇳 China produz     │
  │ 📊 Apontamentos      │
  │ 📦 Embarque          │
  └──────────────────────┘
```

### 2. Bullet points atualizados
Após "Produção só é liberada após aprovação formal do Brasil":
- **Brasil emite Ordem de Compra (OC) para a fábrica na China**
- **China executa a produção com apontamentos de progresso**
- **Embarque registrado ao finalizar — produto segue para o Brasil**

### 3. Fase de Conclusão — ajuste
Renomear "Produção" no diagrama final para "Recebimento Brasil" ou similar, já que a produção é na China.

### Arquivo
- `src/pages/RelatorioDesenvolvimento.tsx` — atualização das Seções 3 (Concepção + diagrama) e ajuste no FIM (Conclusão)


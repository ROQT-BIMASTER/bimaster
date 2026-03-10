

## EAN como Chave Universal de Rastreabilidade China ↔ Brasil

Concordo totalmente. O EAN é o identificador ideal para unificar produtos entre os dois países — é padronizado, único e já utilizado em toda a cadeia (desde o desenvolvimento até o ponto de venda).

### Visão Geral

Usar o EAN como chave de relacionamento permite:
- **Rastreabilidade completa**: Da submissão na China até o estoque no Brasil
- **Vinculação automática**: Ao cadastrar um EAN na China, o sistema já localiza o produto correspondente no Brasil (e vice-versa)
- **Consistência**: Um único código universal em vez de múltiplos códigos internos

### Onde o EAN já existe no sistema

- **Grade de cores (SKU)**: `codigo_barras_ean` por cor/variação
- **Nível produto**: `ean_display` e `ean_caixa_master` na submissão China

### O que falta implementar

1. **Tabela de vínculo EAN centralizada** — Uma tabela `produto_ean_links` que relaciona EANs com produtos tanto do lado China (`china_produto_submissoes`) quanto do lado Brasil (tabela de produtos/SKUs nacional), servindo como "ponte" universal.

2. **Busca cruzada por EAN** — Em qualquer tela de produto (China ou Brasil), ao digitar/escanear um EAN, o sistema localiza automaticamente o produto correspondente no outro lado e exibe o vínculo.

3. **Validação de unicidade** — Garantir que o mesmo EAN não seja cadastrado em dois produtos diferentes (alerta de duplicidade).

4. **Dashboard de cobertura EAN** — Painel mostrando quais produtos já têm EAN vinculado e quais ainda estão pendentes, facilitando o controle.

5. **Propagação automática** — Quando o Brasil cadastra um EAN em um produto, ele aparece automaticamente na ficha China vinculada (e vice-versa).

### Estrutura técnica proposta

```text
┌─────────────────────┐         ┌──────────────────┐
│ china_produto_       │         │ produtos_brasil  │
│ submissoes           │         │ (futuro)         │
│  - ean_display       │         │  - ean           │
│  - ean_caixa_master  │         │  - sku           │
└────────┬────────────┘         └────────┬─────────┘
         │                               │
         └──────────┐   ┌───────────────┘
                    ▼   ▼
              ┌─────────────────┐
              │ produto_ean_map │
              │  - ean (PK)     │
              │  - china_id     │
              │  - brasil_id    │
              │  - tipo (display│
              │    /unidade/    │
              │    master)      │
              └─────────────────┘
```

### Recomendação

Antes de implementar a tabela de vínculo, preciso entender melhor como os produtos do Brasil estão (ou serão) estruturados no sistema. Se ainda não existe uma tabela de produtos Brasil, podemos começar apenas garantindo que os EANs da China estejam bem cadastrados e validados, e criar o vínculo quando o módulo Brasil estiver pronto.

Quer que eu avance com a implementação completa agora, ou prefere começar apenas reforçando a validação e visibilidade dos EANs no fluxo China?



# Plano: Correção de Acesso Indevido a Fotos - Hierarquia e RLS

## Problema Identificado

A usuária **Juliana Germinhasi** (vendedora) está conseguindo visualizar fotos de **Jessika Marcondes** (sua supervisora) na tela Trade Photos. Isso viola a hierarquia de acesso onde:
- Vendedores só podem ver suas próprias fotos
- Supervisores podem ver fotos de seus subordinados
- Admins podem ver todas as fotos

### Causa Raiz (2 problemas críticos)

**1. Policies de Storage Excessivamente Permissivas**
```text
┌─────────────────────────────────────────────────────────────┐
│ BUCKET: trade-photos                                        │
│                                                             │
│ Policy "Fotos são publicamente acessíveis"                  │
│ USING: bucket_id = 'trade-photos'  ← PERMITE TUDO!          │
│                                                             │
│ Policy "Todos podem ver fotos trade"                        │
│ USING: bucket_id = 'trade-photos'  ← DUPLICADA!             │
└─────────────────────────────────────────────────────────────┘
```

**2. Função `is_supervisor_of` Usada de Forma Invertida**
Na policy `Users can view own trade photos` do storage:
```text
┌──────────────────────────────────────────────────────────────┐
│ ERRADO:  is_supervisor_of(auth.uid(), p.vendedor_id)         │
│          ↑ "Juliana é supervisora de Jessika?" → FALSE       │
│          Mas outra policy permite acesso sem verificação!    │
│                                                              │
│ CORRETO: is_supervisor_of(p.vendedor_id, auth.uid())         │
│          ↑ "Jessika é subordinada de Juliana?" → FALSE       │
│          E "Juliana é subordinada de Jessika?" → TRUE        │
└──────────────────────────────────────────────────────────────┘
```

---

## Solução

### 1. Remover Policies de Storage Excessivamente Permissivas
Deletar as policies que permitem acesso irrestrito ao bucket `trade-photos`:
- "Fotos são publicamente acessíveis"
- "Todos podem ver fotos trade"

### 2. Criar Policy de Storage com Hierarquia Correta
Nova policy que verifica:
- Usuário é dono da foto (vendedor_id = auth.uid())
- Usuário é supervisor do dono da foto
- Usuário é admin/supervisor global

### 3. Corrigir Policies de RLS na Tabela `photos`
A policy `Supervisores podem ver fotos de seus subordinados` tem a inversão:
```sql
-- ATUAL (errado):
is_supervisor_of(auth.uid(), vendedor_id)

-- CORRETO:
is_supervisor_of(vendedor_id, auth.uid())
```

---

## Detalhes Técnicos

### Migração SQL

```sql
-- 1. Remover policies permissivas no Storage
DROP POLICY IF EXISTS "Fotos são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Todos podem ver fotos trade" ON storage.objects;

-- 2. Criar policy de Storage com hierarquia correta
CREATE POLICY "Trade photos hierarquia correta" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-photos' 
  AND (
    -- Admin ou supervisor global
    is_admin_or_supervisor(auth.uid())
    -- OU é dono da foto (verifica na tabela photos)
    OR EXISTS (
      SELECT 1 FROM photos p
      WHERE p.photo_url LIKE '%' || objects.name || '%'
      AND (
        p.vendedor_id = auth.uid()
        OR p.supervisor_id = auth.uid()
        -- Supervisor do vendedor pode ver
        OR is_supervisor_of(p.vendedor_id, auth.uid())
      )
    )
  )
);

-- 3. Corrigir policy da tabela photos
DROP POLICY IF EXISTS "Supervisores podem ver fotos de seus subordinados" ON photos;

CREATE POLICY "Supervisores podem ver fotos de subordinados" ON photos
FOR SELECT TO authenticated
USING (
  supervisor_id IS NOT NULL
  AND is_supervisor_of(vendedor_id, auth.uid())
);

-- 4. Corrigir policy "Usuários veem fotos permitidas"
DROP POLICY IF EXISTS "Usuários veem fotos permitidas" ON photos;

CREATE POLICY "Usuários veem fotos permitidas" ON photos
FOR SELECT TO authenticated
USING (
  vendedor_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM visits v
    WHERE v.id = photos.visit_id 
    AND (
      v.user_id = auth.uid()
      OR is_supervisor_of(v.user_id, auth.uid())
    )
  )
);
```

### Validação Pós-Migração

Executar query para confirmar isolamento:
```sql
-- Simular acesso de Juliana às fotos de Jessika (deve retornar FALSE para todas)
SELECT 
  p.id,
  (p.vendedor_id = 'bf225976...'::uuid) as is_owner,
  is_supervisor_of(p.vendedor_id, 'bf225976...'::uuid) as is_supervisor
FROM photos p
WHERE p.vendedor_id = '23d470c6...' -- Jessika
LIMIT 5;
```

---

## Resultado Esperado

| Usuário | Role | Pode Ver Fotos de |
|---------|------|-------------------|
| Juliana | vendedor | Apenas suas próprias |
| Jessika (supervisora) | vendedor | Suas próprias + Juliana |
| Leandro | supervisor | Sua equipe |
| Fabio | admin | Todas |

---

## Impacto

- **Segurança**: Vendedores não terão mais acesso a fotos de outros vendedores
- **Performance**: Nenhum impacto negativo
- **UX**: A tela Trade Photos mostrará apenas fotos autorizadas


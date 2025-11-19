# Diagramas de Arquitetura

Visualizações da arquitetura do BiMaster/Union CRM.

## 🏗️ Visão Geral do Sistema

```mermaid
graph TB
    subgraph Frontend["Frontend - React + Vite"]
        UI[UI Components<br/>Shadcn/UI]
        State[State Management<br/>TanStack Query]
        Router[React Router]
        PWA[PWA Service Worker]
    end

    subgraph Backend["Lovable Cloud - Supabase"]
        Auth[Authentication<br/>Supabase Auth]
        DB[(PostgreSQL<br/>Database)]
        Storage[File Storage<br/>Buckets]
        Functions[Edge Functions<br/>Serverless]
    end

    subgraph External["Integrações Externas"]
        OpenAI[OpenAI API]
        Social[Social Media APIs]
        Maps[Mapbox]
        Stripe[Stripe]
    end

    UI --> State
    State --> Router
    Router --> PWA
    
    State --> Auth
    State --> DB
    State --> Storage
    State --> Functions

    Functions --> OpenAI
    Functions --> Social
    Functions --> Maps
    Functions --> Stripe

    style Frontend fill:#e3f2fd
    style Backend fill:#f3e5f5
    style External fill:#fff3e0
```

## 🔐 Fluxo de Autenticação

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant SupabaseAuth
    participant Database
    participant EdgeFunction

    User->>Frontend: Acessar aplicação
    Frontend->>SupabaseAuth: Verificar sessão
    
    alt Sessão válida
        SupabaseAuth-->>Frontend: Token JWT
        Frontend->>Database: Buscar perfil (RLS)
        Database-->>Frontend: Dados do usuário
        Frontend-->>User: Dashboard
    else Sem sessão
        Frontend-->>User: Tela de login
        User->>Frontend: Email + Senha
        Frontend->>SupabaseAuth: Login
        SupabaseAuth-->>Frontend: Token JWT
        Frontend->>Database: Criar/Buscar perfil
        Database-->>Frontend: Perfil
        Frontend-->>User: Dashboard
    end

    User->>Frontend: Chamar Edge Function
    Frontend->>EdgeFunction: Request + JWT
    EdgeFunction->>SupabaseAuth: Validar JWT
    SupabaseAuth-->>EdgeFunction: User ID
    EdgeFunction->>Database: Query (RLS aplicado)
    Database-->>EdgeFunction: Data
    EdgeFunction-->>Frontend: Response
    Frontend-->>User: Resultado
```

## 📊 Arquitetura de Dados

```mermaid
erDiagram
    profiles ||--o{ prospects : "gerencia"
    profiles ||--o{ atividades : "executa"
    profiles ||--o{ visits : "realiza"
    profiles ||--o{ municipios : "responsavel"
    
    prospects ||--o{ atividades : "tem"
    prospects }o--|| municipios : "localizado"
    
    stores ||--o{ visits : "recebe"
    stores ||--o{ gondola_audits : "tem"
    stores ||--o{ photos : "registra"
    
    visits ||--o{ photos : "contém"
    visits ||--o{ gondola_audits : "gera"
    
    social_media_accounts ||--o{ social_media_metrics : "coleta"
    social_media_accounts }o--|| profiles : "pertence"

    profiles {
        uuid id PK
        string role
        string name
        string email
    }

    prospects {
        uuid id PK
        uuid vendedor_id FK
        uuid municipio_id FK
        string status
        string nome_cliente
    }

    atividades {
        uuid id PK
        uuid prospect_id FK
        uuid vendedor_id FK
        string tipo
        string resultado
    }

    stores {
        uuid id PK
        string name
        string store_chain
        geography location
    }

    visits {
        uuid id PK
        uuid store_id FK
        uuid vendedor_id FK
        timestamp visit_date
    }
```

## 🔄 Fluxo de Sincronização de Social Media

```mermaid
graph LR
    subgraph User Actions
        A[Usuário clica<br/>'Sincronizar']
    end

    subgraph Frontend
        B[MultiAccountDashboard]
        C[syncAccount função]
    end

    subgraph Edge Functions
        D[sync-all-accounts]
        E[social-media-metrics]
    end

    subgraph External APIs
        F[Instagram API]
        G[Facebook API]
        H[TikTok API]
        I[LinkedIn API]
    end

    subgraph Database
        J[(social_media_accounts)]
        K[(social_media_metrics)]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    E --> G
    E --> H
    E --> I
    F --> E
    G --> E
    H --> E
    I --> E
    E --> K
    D --> J
    K --> C
    J --> C
    C --> B

    style A fill:#4caf50
    style B fill:#2196f3
    style D fill:#ff9800
    style E fill:#ff9800
    style J fill:#9c27b0
    style K fill:#9c27b0
```

## 📸 Fluxo de Análise de Fotos

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Upload
    participant Queue
    participant Processor
    participant AI
    participant Database

    User->>Frontend: Tirar/Carregar foto
    Frontend->>Upload: Upload para Storage
    Upload-->>Frontend: Photo URL
    Frontend->>Queue: Adicionar à fila
    Queue-->>Frontend: Queue ID
    
    Note over Queue,Processor: Processamento Assíncrono
    
    Processor->>Queue: Buscar próximo item
    Queue-->>Processor: Photo data
    Processor->>AI: Analisar foto
    AI-->>Processor: Análise (produtos, facings, etc)
    Processor->>Database: Salvar resultado
    Database-->>Processor: Success
    Processor->>Queue: Marcar como processado
    
    Frontend->>Database: Poll status
    Database-->>Frontend: Resultado
    Frontend-->>User: Mostrar análise
```

## 🎯 Arquitetura de Trade Marketing

```mermaid
graph TB
    subgraph Trade Module
        Visits[Visitas]
        Audits[Auditorias]
        Photos[Fotos]
        Stores[Lojas]
        Performance[Performance]
    end

    subgraph Data Collection
        Mobile[App Mobile]
        GPS[Geolocalização]
        Camera[Câmera]
    end

    subgraph Analytics
        KPIs[KPIs Tracking]
        Reports[Relatórios]
        Insights[AI Insights]
    end

    subgraph Storage
        PhotoBucket[Photos Bucket]
        DB[(Database)]
    end

    Mobile --> Visits
    GPS --> Visits
    Camera --> Photos
    
    Visits --> Audits
    Photos --> Audits
    Stores --> Visits
    
    Audits --> KPIs
    KPIs --> Reports
    Reports --> Insights
    
    Photos --> PhotoBucket
    Audits --> DB
    KPIs --> DB

    style Trade Module fill:#e1f5fe
    style Data Collection fill:#fff3e0
    style Analytics fill:#f3e5f5
    style Storage fill:#e8f5e9
```

## 🔄 Sistema de Offline/Online

```mermaid
stateDiagram-v2
    [*] --> CheckConnection
    
    CheckConnection --> Online: navigator.onLine = true
    CheckConnection --> Offline: navigator.onLine = false
    
    Online --> SyncData: Auto-sync
    Online --> NormalOperation: Operação normal
    
    Offline --> QueueOperation: Salvar em IndexedDB
    Offline --> UseCachedData: Usar cache
    
    QueueOperation --> Offline
    UseCachedData --> Offline
    
    Offline --> Online: Conexão restaurada
    
    Online --> SyncQueue: Processar fila
    SyncQueue --> ClearQueue: Sucesso
    SyncQueue --> HandleConflicts: Conflitos
    
    HandleConflicts --> ResolveConflicts
    ResolveConflicts --> ClearQueue
    
    ClearQueue --> NormalOperation
    NormalOperation --> [*]
```

## 🧠 Sistema de IA e Insights

```mermaid
graph LR
    subgraph Data Sources
        A[Prospects]
        B[Atividades]
        C[Social Media]
        D[Trade Data]
    end

    subgraph AI Processing
        E[Data Aggregation]
        F[Pattern Analysis]
        G[OpenAI API]
    end

    subgraph Insights Generation
        H[Marketing Insights]
        I[Sales Insights]
        J[Trade Insights]
    end

    subgraph Actions
        K[Recommendations]
        L[Alerts]
        M[Reports]
    end

    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    F --> G
    
    G --> H
    G --> I
    G --> J
    
    H --> K
    I --> K
    J --> K
    
    K --> L
    K --> M

    style Data Sources fill:#e3f2fd
    style AI Processing fill:#fff3e0
    style Insights Generation fill:#f3e5f5
    style Actions fill:#e8f5e9
```

## 🔒 Camadas de Segurança

```mermaid
graph TB
    subgraph Application Layer
        UI[UI Components]
        Auth[Auth Guards]
    end

    subgraph API Layer
        EdgeFn[Edge Functions]
        JWT[JWT Validation]
    end

    subgraph Database Layer
        RLS[Row Level Security]
        Policies[RLS Policies]
    end

    subgraph Storage Layer
        Buckets[Storage Buckets]
        SignedURLs[Signed URLs]
    end

    UI --> Auth
    Auth --> EdgeFn
    EdgeFn --> JWT
    JWT --> RLS
    RLS --> Policies
    
    UI --> Buckets
    Buckets --> SignedURLs
    SignedURLs --> Policies

    style Application Layer fill:#ffebee
    style API Layer fill:#fff3e0
    style Database Layer fill:#e8f5e9
    style Storage Layer fill:#e3f2fd
```

## 📈 Fluxo de Performance Monitoring

```mermaid
graph LR
    subgraph Application
        A[Component Render]
        B[API Call]
        C[Query Execution]
    end

    subgraph Performance Monitor
        D[Record Metric]
        E[Check Threshold]
        F[Store in Memory]
    end

    subgraph Analysis
        G[Calculate Averages]
        H[Generate Warnings]
        I[Export Report]
    end

    subgraph Actions
        J[Console Warning]
        K[Analytics Event]
        L[Dashboard]
    end

    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> F
    
    F --> G
    G --> H
    
    H --> J
    H --> K
    
    F --> I
    I --> L

    style Application fill:#e3f2fd
    style Performance Monitor fill:#fff3e0
    style Analysis fill:#f3e5f5
    style Actions fill:#e8f5e9
```

---

## 📚 Convenções de Arquitetura

### Estrutura de Pastas

```
src/
├── components/        # Componentes reutilizáveis
│   ├── ui/           # Componentes base (Shadcn)
│   ├── marketing/    # Módulo de Marketing
│   ├── trade/        # Módulo Trade
│   └── prospects/    # Módulo Prospects
├── pages/            # Páginas/Rotas
├── hooks/            # Custom hooks
├── lib/              # Utilitários
│   ├── utils/        # Funções auxiliares
│   └── validations/  # Schemas Zod
├── integrations/     # Integrações externas
└── test/             # Setup de testes
```

### Padrões de Nomenclatura

- **Componentes**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase com prefixo use (`useUserData.ts`)
- **Utilitários**: camelCase (`formatDate.ts`)
- **Constantes**: UPPER_SNAKE_CASE (`API_ENDPOINTS`)

### Fluxo de Dados

1. **Unidirecional**: Top-down (parent → child)
2. **State Management**: TanStack Query para server state
3. **Local State**: useState/useReducer para UI state
4. **Context**: Apenas para temas, auth, configurações globais

---

**Última atualização:** 2025-01-19  
**Versão:** 1.0.0

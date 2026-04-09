import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WhatsAppAgentFlow() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagrama de Fluxo do Agente</CardTitle>
        <CardDescription>
          Visualização completa do fluxo de conversação e tomada de decisão do agente de IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          dangerouslySetInnerHTML={{
            __html: `<lov-mermaid>
graph TD
    A[Início - Mensagem Recebida] --> B{Conversa Ativa?}
    B -->|Não| C[Criar Nova Conversa]
    B -->|Sim| D[Recuperar Contexto]
    
    C --> E{Tipo de Mensagem?}
    D --> E
    
    E -->|Comando /novo| F[Iniciar Novo Registro]
    E -->|Comando /cancelar| G[Cancelar e Encerrar]
    E -->|Comando /ajuda| H[Enviar Ajuda]
    E -->|Mensagem Normal| I{Qual Passo Atual?}
    E -->|Imagem| J{Esperando Foto?}
    
    F --> K[Passo: Solicitar Nome Loja]
    
    I -->|aguardando_loja| L[Validar Nome Loja]
    I -->|aguardando_data| M[Validar Data]
    I -->|aguardando_foto_antes| N[Solicitar Foto Antes]
    I -->|aguardando_foto_depois| O[Solicitar Foto Depois]
    I -->|aguardando_faces| P[Validar Quantidade Faces]
    
    J -->|Sim - Foto Antes| Q[Salvar Foto Antes]
    J -->|Sim - Foto Depois| R[Salvar Foto Depois]
    J -->|Não| S[Orientar sobre Fluxo]
    
    L -->|Válido| T[Avançar para Data]
    L -->|Inválido| U[Solicitar Novamente]
    
    M -->|Válido| V{Usa IA?}
    M -->|Inválido| W[Solicitar Novamente]
    
    V -->|Sim| X[Chamar Bimaster AI]
    V -->|Não| Y[Resposta Padrão]
    
    X --> Z[Processar Resposta IA]
    Y --> Z
    
    T --> AA[Próximo Passo]
    Q --> AA
    R --> AA
    P --> AB{Completo?}
    
    AB -->|Sim| AC[Criar Lançamento]
    AB -->|Não| AA
    
    AC --> AD[Salvar no Banco]
    AD --> AE[Enviar Confirmação]
    AE --> AF[Encerrar Conversa]
    
    U --> AG[Atualizar Contexto]
    W --> AG
    S --> AG
    Z --> AG
    AA --> AG
    
    AG --> AH[Salvar Contexto]
    AH --> AI[Registrar Mensagem]
    AI --> AJ[Enviar Resposta WhatsApp]
    
    G --> AF
    H --> AJ
    
    AJ --> AK[Fim]
    AF --> AK
    
    style A fill:#e1f5ff
    style AC fill:#d4edda
    style AF fill:#d4edda
    style G fill:#f8d7da
    style X fill:#fff3cd
    style V fill:#fff3cd
</lov-mermaid>`
          }}
        />
        
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Pontos de Decisão Principais:</h4>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• <strong>Conversa Ativa:</strong> Verifica se já existe uma conversa em andamento para o usuário</li>
              <li>• <strong>Tipo de Mensagem:</strong> Identifica comandos especiais (/novo, /cancelar, /ajuda) ou mensagens normais</li>
              <li>• <strong>Passo Atual:</strong> Determina qual informação deve ser coletada no momento</li>
              <li>• <strong>Validações:</strong> Aplica regras específicas para cada tipo de dado (nome, data, números)</li>
              <li>• <strong>Uso de IA:</strong> Decide quando usar Bimaster AI para respostas mais contextuais (especialmente na seleção de loja)</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Legenda de Cores:</h4>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• <span className="text-blue-600">Azul:</span> Ponto de entrada</li>
              <li>• <span className="text-green-600">Verde:</span> Finalização bem-sucedida</li>
              <li>• <span className="text-red-600">Vermelho:</span> Cancelamento</li>
              <li>• <span className="text-yellow-600">Amarelo:</span> Processamento com IA</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

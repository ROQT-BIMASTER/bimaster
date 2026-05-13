export type ChatTipoConversa = "private" | "group" | "privada" | "grupo";
export type ChatTipoMensagem = "texto" | "imagem" | "arquivo" | "audio" | "video" | "sistema";

export interface ChatProfile {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
  departamento_id?: string | null;
}

export interface ChatConversa {
  id: string;
  nome: string | null;
  tipo: ChatTipoConversa;
  descricao: string | null;
  avatar_url: string | null;
  criado_por: string | null;
  arquivada_em: string | null;
  ultima_mensagem_em: string | null;
  updated_at: string;
  // resolvidos no client
  outroUsuario?: ChatProfile | null;
  ultimaMensagem?: { conteudo: string; created_at: string; tipo: string; remetente_id: string } | null;
  naoLidas: number;
  favorita: boolean;
  arquivada: boolean;
  silenciada_ate: string | null;
  papel: "admin" | "membro";
  participantes_count?: number;
}

export interface ChatAnexo {
  id: string;
  mensagem_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  thumbnail_path?: string | null;
}

export interface ChatReacao {
  id: string;
  emoji: string;
  user_id: string;
}

export interface ChatLeitura {
  user_id: string;
  lida_em: string;
}

export interface ChatMensagem {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  tipo: ChatTipoMensagem;
  responde_a_id: string | null;
  encaminhada_de_id: string | null;
  editada_em: string | null;
  excluida_em: string | null;
  excluida_para_todos: boolean;
  fixada_em: string | null;
  mencoes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  remetente?: ChatProfile | null;
  responde_a?: Pick<ChatMensagem, "id" | "conteudo" | "remetente_id" | "tipo"> | null;
  anexos?: ChatAnexo[];
  reacoes?: ChatReacao[];
  leituras?: ChatLeitura[];
  favorita?: boolean;
}

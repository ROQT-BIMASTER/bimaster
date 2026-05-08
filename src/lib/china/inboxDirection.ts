import type { MailboxItem } from "@/hooks/useChinaMailbox";

export type DirectionKind =
  | "incoming_new"      // CN -> BR, primeira vez
  | "incoming_redo"     // CN -> BR, reenvio após ajuste
  | "incoming_review"   // BR -> outro BR (em análise interna)
  | "outgoing_adjust"   // BR -> CN, pediu ajuste
  | "closed_approved"   // encerrado aprovado
  | "closed_rejected"   // encerrado rejeitado
  | "draft"             // ainda não enviado
  | "neutral";          // não classificado

export type DirectionTone =
  | "primary"   // azul - bola comigo, novo
  | "warning"   // âmbar - reenvio / atenção
  | "violet"    // em revisão interna
  | "rose"      // ajuste pendente do outro lado
  | "success"   // aprovado
  | "destructive" // rejeitado
  | "muted";    // rascunho / neutro

export interface DirectionInfo {
  kind: DirectionKind;
  /** "→ BR", "← CN", "↻ BR", "✓✓"  */
  arrow: string;
  /** Frase curta (lista) — PT */
  label: string;
  /** Frase curta (lista) — CN */
  labelCn: string;
  /** Sublabel "ação" (lista) — PT */
  action: string;
  /** Sublabel "ação" (lista) — CN */
  actionCn: string;
  /** Frase completa em uma linha (painel de leitura) — PT */
  sentence: string;
  /** Frase completa em uma linha (painel de leitura) — CN */
  sentenceCn: string;
  tone: DirectionTone;
  /** True quando a próxima ação é do viewer atual */
  ballOnViewer: boolean;
}

export interface ViewerCtx {
  isBrasilUser: boolean;
  isChinaUser: boolean;
}

const TONE_CLASSES: Record<DirectionTone, { badge: string; band: string; dot: string }> = {
  primary: {
    badge: "bg-primary/15 text-primary border-primary/30",
    band: "bg-primary/10 border-primary/30 text-primary",
    dot: "bg-primary",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    band: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    dot: "bg-amber-400",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    band: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    dot: "bg-violet-400",
  },
  rose: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    band: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    dot: "bg-rose-400",
  },
  success: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    band: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    dot: "bg-emerald-400",
  },
  destructive: {
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    band: "bg-destructive/10 border-destructive/30 text-destructive",
    dot: "bg-destructive",
  },
  muted: {
    badge: "bg-muted/40 text-muted-foreground border-border",
    band: "bg-muted/30 border-border text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};

export function toneClasses(tone: DirectionTone) {
  return TONE_CLASSES[tone];
}

/**
 * Resolve direção e ação esperada a partir do estado atual do item.
 * Pura — sem efeitos colaterais. Cobre os casos do fluxo China <-> Brasil.
 */
export function resolveDirection(
  item: MailboxItem & { had_previous_rejection?: boolean },
  viewer: ViewerCtx,
): DirectionInfo {
  const sub = item.submissao_status;
  const doc = item.doc_status;
  const redo = !!item.had_previous_rejection;

  // Fechamentos
  if (sub === "aprovado") {
    return {
      kind: "closed_approved",
      arrow: "✓✓",
      label: "Encerrado",
      labelCn: "已结束",
      action: "Aprovado",
      actionCn: "已批准",
      sentence: "Documento já aprovado. Não há ação pendente.",
      sentenceCn: "文件已批准，无需进一步操作。",
      tone: "success",
      ballOnViewer: false,
    };
  }
  if (sub === "rejeitado") {
    return {
      kind: "closed_rejected",
      arrow: "✕",
      label: "Encerrado",
      labelCn: "已结束",
      action: "Rejeitado",
      actionCn: "已拒绝",
      sentence: "Submissão rejeitada e encerrada.",
      sentenceCn: "提交已拒绝并关闭。",
      tone: "destructive",
      ballOnViewer: false,
    };
  }
  if (sub === "rascunho") {
    return {
      kind: "draft",
      arrow: "…",
      label: "Rascunho",
      labelCn: "草稿",
      action: "Ainda não enviado",
      actionCn: "尚未发送",
      sentence: "Rascunho — ainda não foi enviado para o Brasil.",
      sentenceCn: "草稿——尚未发送至巴西。",
      tone: "muted",
      ballOnViewer: viewer.isChinaUser,
    };
  }

  // Documento aguardando ajuste do lado China
  if (doc === "rejeitado") {
    return {
      kind: "outgoing_adjust",
      arrow: viewer.isBrasilUser ? "← CN" : "→ você",
      label: viewer.isBrasilUser ? "Você pediu ajuste" : "Brasil pediu ajuste",
      labelCn: "巴西要求修正",
      action: viewer.isBrasilUser ? "China está tratando" : "Corrigir e reenviar",
      actionCn: viewer.isBrasilUser ? "中国处理中" : "修正后重新提交",
      sentence: viewer.isBrasilUser
        ? "Você pediu ajuste neste documento. Aguardando a China corrigir e reenviar."
        : "O Brasil pediu ajuste neste documento. Veja o motivo abaixo, corrija e reenvie.",
      sentenceCn: viewer.isBrasilUser
        ? "您已请求修正，等待中国修改后重新发送。"
        : "巴西要求修正此文件。请查看下方原因，修正后重新提交。",
      tone: "rose",
      ballOnViewer: viewer.isChinaUser,
    };
  }

  // Em revisão interna do Brasil (sem ação direta no doc agora)
  if (sub === "em_revisao") {
    return {
      kind: "incoming_review",
      arrow: "→ BR",
      label: "Em análise no Brasil",
      labelCn: "巴西审核中",
      action: viewer.isBrasilUser ? "Outro responsável avaliando" : "Aguarde retorno",
      actionCn: viewer.isBrasilUser ? "其他负责人审核中" : "等待回复",
      sentence: viewer.isBrasilUser
        ? "Submissão em análise interna no Brasil. Outro responsável está avaliando."
        : "Submissão em análise no Brasil. Aguarde retorno.",
      sentenceCn: viewer.isBrasilUser
        ? "提交正在巴西内部审核中，由其他负责人评估。"
        : "提交正在巴西审核中，请等待回复。",
      tone: "violet",
      ballOnViewer: false,
    };
  }

  // Documento aguardando aprovação do Brasil
  if (doc === "pendente" || doc === "enviado" || doc === "contestado") {
    if (redo) {
      return {
        kind: "incoming_redo",
        arrow: viewer.isBrasilUser ? "↻ você" : "→ BR",
        label: "China reenviou",
        labelCn: "中国重新提交",
        action: viewer.isBrasilUser ? "Revisar correção" : "Aguarda Brasil",
        actionCn: viewer.isBrasilUser ? "复查修正" : "等待巴西",
        sentence: viewer.isBrasilUser
          ? "A China corrigiu o ajuste que você pediu. Compare com a versão anterior e aprove se estiver ok."
          : "Você reenviou o documento corrigido. Aguarde a aprovação do Brasil.",
        sentenceCn: viewer.isBrasilUser
          ? "中国已根据您的要求修正。请与上一版本比较，确认无误后批准。"
          : "您已重新提交修正后的文件，等待巴西批准。",
        tone: "warning",
        ballOnViewer: viewer.isBrasilUser,
      };
    }
    return {
      kind: "incoming_new",
      arrow: viewer.isBrasilUser ? "→ você" : "→ BR",
      label: "China enviou",
      labelCn: "中国已发送",
      action: viewer.isBrasilUser ? "Aguarda sua aprovação" : "Aguarda Brasil",
      actionCn: viewer.isBrasilUser ? "等待您的批准" : "等待巴西",
      sentence: viewer.isBrasilUser
        ? "A China enviou este documento para você aprovar. Verifique o anexo e clique em Aprovar ou Pedir ajuste."
        : "Documento enviado ao Brasil. Aguarde a aprovação.",
      sentenceCn: viewer.isBrasilUser
        ? "中国发送此文件请您批准。请查看附件，然后点击批准或请求修正。"
        : "文件已发送至巴西，等待批准。",
      tone: "primary",
      ballOnViewer: viewer.isBrasilUser,
    };
  }

  // Default
  return {
    kind: "neutral",
    arrow: "·",
    label: "Em andamento",
    labelCn: "进行中",
    action: "—",
    actionCn: "—",
    sentence: "Acompanhe o andamento desta submissão.",
    sentenceCn: "请跟踪此提交的进展。",
    tone: "muted",
    ballOnViewer: false,
  };
}

import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, Target, CheckCircle2, ArrowRight } from "lucide-react";

interface MeetingAtaProps {
  ata: string | null;
  participants?: any[] | null;
}

export function MeetingAta({ ata, participants }: MeetingAtaProps) {
  if (!ata) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <FileText className="h-5 w-5 mr-2" />
        Nenhuma ata disponível. Analise a reunião com IA para gerar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Participants */}
      {participants && participants.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Participantes Identificados</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p: any, i: number) => {
                const colors = [
                  "bg-blue-100 text-blue-700 border-blue-200",
                  "bg-emerald-100 text-emerald-700 border-emerald-200",
                  "bg-purple-100 text-purple-700 border-purple-200",
                  "bg-amber-100 text-amber-700 border-amber-200",
                  "bg-rose-100 text-rose-700 border-rose-200",
                  "bg-cyan-100 text-cyan-700 border-cyan-200",
                ];
                const color = colors[i % colors.length];
                const name = typeof p === "string" ? p : p.name || p.nome || `Falante ${i + 1}`;
                return (
                  <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {name}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ata content */}
      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{ata}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

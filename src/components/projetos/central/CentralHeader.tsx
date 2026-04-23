import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard } from "lucide-react";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

interface Props {
  bgColor: string | null;
  onBgColorChange: (color: string | null) => void;
}

export function CentralHeader({ bgColor, onBgColorChange }: Props) {
  const { user } = useAuth();
  const [showNewTask, setShowNewTask] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const firstName = profileData?.nome?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ProjetoBgColorPicker value={bgColor} onChange={onBgColorChange} />
          <div>
            <p className="text-xs text-muted-foreground capitalize">{today}</p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
    </>
  );
}

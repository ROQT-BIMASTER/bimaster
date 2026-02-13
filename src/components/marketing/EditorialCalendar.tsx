import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Clock, Image } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduledPost {
  id: string;
  content: string;
  scheduled_at: string;
  status: string;
  media_urls: string[];
  account_ids: string[];
}

interface EditorialCalendarProps {
  onSelectPost?: (post: ScheduledPost) => void;
}

export const EditorialCalendar = ({ onSelectPost }: EditorialCalendarProps) => {
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadPosts(); }, [currentMonth]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const { data, error } = await supabase.from("social_media_posts").select("*").gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString()).order("scheduled_at", { ascending: true });
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Erro ao carregar posts:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os posts agendados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const getPostsForDay = (date: Date) => posts.filter((post) => isSameDay(new Date(post.scheduled_at), date));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-500";
      case "published": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "publishing": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled": return t("mkt.status_scheduled");
      case "published": return t("mkt.status_published");
      case "failed": return t("mkt.status_failed");
      case "publishing": return t("mkt.status_publishing");
      case "draft": return t("mkt.status_draft");
      default: return status;
    }
  };

  const weekdays = t("mkt.weekdays").split(",");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("mkt.editorial_calendar")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium min-w-[120px] text-center">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</span>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>{t("mkt.today")}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t("loading")}</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekdays.map((day) => (
                <div key={day} className="text-center font-semibold text-sm py-2">{day}</div>
              ))}
              {daysInMonth.map((date) => {
                const dayPosts = getPostsForDay(date);
                const isToday = isSameDay(date, new Date());
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                return (
                  <button key={date.toISOString()} onClick={() => setSelectedDate(date)} className={cn("min-h-[100px] p-2 border rounded-lg text-left hover:bg-accent transition-colors", isToday && "border-primary border-2", isSelected && "bg-accent", !isSameMonth(date, currentMonth) && "opacity-40")}>
                    <div className="font-medium text-sm mb-1">{format(date, "d")}</div>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 2).map((post) => (
                        <div key={post.id} className={cn("text-xs p-1 rounded truncate cursor-pointer hover:opacity-80", getStatusColor(post.status), "text-white")} onClick={(e) => { e.stopPropagation(); onSelectPost?.(post); }} title={post.content}>
                          <Clock className="w-3 h-3 inline mr-1" />{format(new Date(post.scheduled_at), "HH:mm")}
                        </div>
                      ))}
                      {dayPosts.length > 2 && <div className="text-xs text-muted-foreground">+{dayPosts.length - 2} {t("mkt.more")}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>{t("mkt.posts_of")} {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</CardTitle>
          </CardHeader>
          <CardContent>
            {getPostsForDay(selectedDate).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t("mkt.no_posts_day")}</p>
            ) : (
              <div className="space-y-4">
                {getPostsForDay(selectedDate).map((post) => (
                  <div key={post.id} className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => onSelectPost?.(post)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{format(new Date(post.scheduled_at), "HH:mm")}</span>
                      </div>
                      <Badge className={getStatusColor(post.status)}>{getStatusLabel(post.status)}</Badge>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                    {post.media_urls.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Image className="w-3 h-3" />{post.media_urls.length} {t("mkt.media_count")}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">{post.account_ids.length} {t("mkt.accounts_selected")}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

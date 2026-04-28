DROP TRIGGER IF EXISTS trg_notify_message_mentions ON public.projeto_tarefa_messages;
CREATE TRIGGER trg_notify_message_mentions
AFTER INSERT ON public.projeto_tarefa_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_task_mentions();
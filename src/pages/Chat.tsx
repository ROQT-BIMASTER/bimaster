import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChatLayout } from "@/components/chat/v2/ChatLayout";

const Chat = () => {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-7rem)] -mx-3 sm:-mx-4 lg:-mx-6 -mt-3 sm:-mt-4 lg:-mt-6 rounded-none border border-border overflow-hidden">
        <ChatLayout defaultShowInfo={false} />
      </div>
    </DashboardLayout>
  );
};

export default Chat;

import { PluggyConnect } from "react-pluggy-connect";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export function PluggyConnectWidget({
  connectToken,
  includeSandbox = true,
  onSuccess,
  onError,
  onClose,
}: PluggyConnectWidgetProps) {
  return (
    <div style={{ minHeight: 500 }}>
      <PluggyConnect
        connectToken={connectToken}
        includeSandbox={includeSandbox}
        onSuccess={(data) => {
          console.log("✅ Pluggy onSuccess", data);
          onSuccess(data);
        }}
        onError={(error) => {
          console.error("❌ Pluggy onError:", error);
          onError?.(error);
        }}
        onClose={() => {
          console.log("Pluggy closed");
          onClose?.();
        }}
      />
    </div>
  );
}

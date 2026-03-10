import { useCallback } from "react";
import { PluggyConnect } from "react-pluggy-connect";

interface PluggyConnectWidgetProps {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (itemData: any) => void;
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
  const handleSuccess = useCallback(
    (data: any) => {
      console.log("✅ Pluggy onSuccess", data);
      onSuccess(data);
    },
    [onSuccess]
  );

  const handleError = useCallback(
    (error: any) => {
      console.error("❌ Pluggy onError:", error);
      onError?.(error);
    },
    [onError]
  );

  return (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={includeSandbox}
      onSuccess={handleSuccess}
      onError={handleError}
      onClose={onClose}
    />
  );
}

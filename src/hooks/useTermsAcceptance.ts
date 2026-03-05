import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CURRENT_VERSIONS = {
  privacy_policy: "1.0",
  terms_of_use: "1.0",
};

export const useTermsAcceptance = () => {
  const { user } = useAuth();
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAcceptance = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("terms_acceptance")
        .select("document_type, document_version")
        .eq("user_id", user.id);

      if (error) throw error;

      const accepted = new Set(
        (data || []).map((r: any) => `${r.document_type}:${r.document_version}`)
      );

      const allAccepted = Object.entries(CURRENT_VERSIONS).every(
        ([type, version]) => accepted.has(`${type}:${version}`)
      );

      setNeedsAcceptance(!allAccepted);
    } catch (err) {
      console.error("[useTermsAcceptance] Error:", err);
      setNeedsAcceptance(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAcceptance();
  }, [user?.id]);

  const acceptTerms = async () => {
    if (!user?.id) return;

    const records = Object.entries(CURRENT_VERSIONS).map(([type, version]) => ({
      user_id: user.id,
      document_type: type,
      document_version: version,
    }));

    const { error } = await supabase
      .from("terms_acceptance")
      .upsert(records, { onConflict: "user_id,document_type,document_version" });

    if (error) throw error;

    setNeedsAcceptance(false);
  };

  return { needsAcceptance, loading, acceptTerms, CURRENT_VERSIONS };
};

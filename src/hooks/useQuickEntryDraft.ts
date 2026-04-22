import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debounce } from "@/lib/utils/debounce";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const STORAGE_PREFIX = "trade:quick-entry:draft:";

export interface QuickEntryDraftPayload {
  formData: any;
  currentStep: number;
  brandMeasurements: any[];
  savedAt: number; // epoch ms
}

interface UseQuickEntryDraftReturn {
  /** Save draft (debounced 500ms). Pass nothing to save the latest tracked snapshot. */
  saveDraft: (snapshot: Omit<QuickEntryDraftPayload, "savedAt">) => void;
  /** Load draft synchronously if exists and not expired */
  loadDraft: () => QuickEntryDraftPayload | null;
  /** Remove draft from storage */
  clearDraft: () => void;
  /** Check whether a valid draft exists */
  hasDraft: () => boolean;
  /** Timestamp (ms) of the last successful save (for "saved Xs ago" UI) */
  lastSavedAt: number | null;
}

/**
 * Persists Quick Entry form state in localStorage scoped by user_id.
 * - Files (photos) are NOT persisted (binary too large for localStorage).
 * - Auto-cleans drafts older than 24h.
 */
export function useQuickEntryDraft(): UseQuickEntryDraftReturn {
  const [userId, setUserId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const storageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user?.id) {
        setUserId(data.user.id);
        storageKeyRef.current = `${STORAGE_PREFIX}${data.user.id}`;
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const writeToStorage = useCallback((snapshot: Omit<QuickEntryDraftPayload, "savedAt">) => {
    if (!storageKeyRef.current) return;
    try {
      // Strip File objects from photo arrays to avoid storage explosion / serialization errors
      const sanitizedFormData = sanitizeFormDataForStorage(snapshot.formData);
      const payload: QuickEntryDraftPayload = {
        formData: sanitizedFormData,
        currentStep: snapshot.currentStep,
        brandMeasurements: snapshot.brandMeasurements,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKeyRef.current, JSON.stringify(payload));
      setLastSavedAt(payload.savedAt);
    } catch (err) {
      // Quota exceeded or serialization error — fail silently, draft is best-effort
      console.warn("[useQuickEntryDraft] save failed:", err);
    }
  }, []);

  const debouncedWriteRef = useRef(debounce(writeToStorage, 500));
  // Keep latest writeToStorage inside the debounced wrapper
  useEffect(() => {
    debouncedWriteRef.current = debounce(writeToStorage, 500);
  }, [writeToStorage]);

  const saveDraft = useCallback((snapshot: Omit<QuickEntryDraftPayload, "savedAt">) => {
    debouncedWriteRef.current(snapshot);
  }, []);

  const loadDraft = useCallback((): QuickEntryDraftPayload | null => {
    if (!storageKeyRef.current) return null;
    try {
      const raw = localStorage.getItem(storageKeyRef.current);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as QuickEntryDraftPayload;
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(storageKeyRef.current);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    if (!storageKeyRef.current) return;
    try {
      localStorage.removeItem(storageKeyRef.current);
      setLastSavedAt(null);
    } catch {
      /* noop */
    }
  }, []);

  const hasDraft = useCallback((): boolean => {
    return loadDraft() !== null;
  }, [loadDraft]);

  return { saveDraft, loadDraft, clearDraft, hasDraft, lastSavedAt };
}

/**
 * Replaces File[] arrays with empty arrays so the snapshot is JSON-safe and small.
 */
function sanitizeFormDataForStorage(formData: any): any {
  if (!formData || typeof formData !== "object") return formData;
  const clone: any = { ...formData };
  for (const key of Object.keys(clone)) {
    const value = clone[key];
    if (Array.isArray(value) && value.some((v) => v instanceof File)) {
      clone[key] = [];
    }
  }
  return clone;
}

/**
 * Format relative time in Portuguese (BR) — used by the draft banner / badge.
 */
export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "agora mesmo";
  if (diffSec < 60) return `há ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `há ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `há ${diffDay}d`;
}

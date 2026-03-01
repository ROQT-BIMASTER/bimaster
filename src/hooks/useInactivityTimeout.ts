import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const WARNING_MS = 5 * 60 * 1000; // 5 minutes before timeout
const WARNING_AT_MS = TIMEOUT_MS - WARNING_MS; // 115 min
const THROTTLE_MS = 30_000; // 30s throttle for activity events
const COUNTDOWN_INTERVAL_MS = 1_000;

interface InactivityState {
  showWarning: boolean;
  secondsLeft: number;
  resetTimer: () => void;
}

export function useInactivityTimeout(): InactivityState {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_MS / 1000));

  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const throttleRef = useRef(0);
  const isVisibleRef = useRef(true);
  const pausedAtRef = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const performLogout = useCallback(async () => {
    clearAllTimers();

    // 1. Audit log (fire-and-forget)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("access_audit_log").insert({
          user_id: user.id,
          action: "session_timeout",
          success: true,
          user_agent: navigator.userAgent,
        }).then(() => {});
      }
    } catch {
      // Never block logout
    }

    // 2. Sign out
    try {
      await supabase.auth.signOut();
    } catch {
      // Fallback: force redirect
    }

    // 3. Clear caches
    try {
      localStorage.removeItem("user_approved_cache");
      localStorage.removeItem("user_active_cache");
      localStorage.removeItem("user_role_cache");
    } catch {
      // Ignore
    }

    // 4. Redirect
    try {
      navigate("/auth/login", { replace: true });
    } catch {
      window.location.href = "/auth/login";
    }
  }, [clearAllTimers, navigate]);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsLeft(Math.floor(WARNING_MS / 1000));
    lastActivityRef.current = Date.now();

    // Warning timer at 115 min
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.floor(WARNING_MS / 1000));

      // Start countdown
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            performLogout();
            return 0;
          }
          return prev - 1;
        });
      }, COUNTDOWN_INTERVAL_MS);
    }, WARNING_AT_MS);

    // Hard logout at 120 min (safety net)
    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, TIMEOUT_MS);
  }, [clearAllTimers, performLogout]);

  const resetTimer = useCallback(() => {
    startTimers();
  }, [startTimers]);

  // Activity detection with throttle
  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - throttleRef.current < THROTTLE_MS) return;
    throttleRef.current = now;

    // Only reset if warning is NOT showing (user must click button)
    if (!showWarning) {
      lastActivityRef.current = now;
      startTimers();
    }
  }, [showWarning, startTimers]);

  // Visibility change: pause/resume
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Tab hidden: pause timers, record elapsed
      isVisibleRef.current = false;
      pausedAtRef.current = Date.now();
      clearAllTimers();
    } else {
      // Tab visible: check how much time passed
      isVisibleRef.current = true;
      const pausedAt = pausedAtRef.current;
      if (!pausedAt) {
        startTimers();
        return;
      }

      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= TIMEOUT_MS) {
        // Already expired while hidden
        performLogout();
      } else if (elapsed >= WARNING_AT_MS) {
        // In warning zone
        const remaining = TIMEOUT_MS - elapsed;
        setShowWarning(true);
        setSecondsLeft(Math.floor(remaining / 1000));

        clearAllTimers();
        countdownRef.current = setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              performLogout();
              return 0;
            }
            return prev - 1;
          });
        }, COUNTDOWN_INTERVAL_MS);

        logoutTimerRef.current = setTimeout(() => {
          performLogout();
        }, remaining);
      } else {
        // Still within safe window, restart with remaining time
        const remaining = WARNING_AT_MS - elapsed;
        clearAllTimers();
        setShowWarning(false);

        warningTimerRef.current = setTimeout(() => {
          setShowWarning(true);
          setSecondsLeft(Math.floor(WARNING_MS / 1000));
          countdownRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
              if (prev <= 1) {
                performLogout();
                return 0;
              }
              return prev - 1;
            });
          }, COUNTDOWN_INTERVAL_MS);
        }, remaining);

        logoutTimerRef.current = setTimeout(() => {
          performLogout();
        }, TIMEOUT_MS - elapsed);
      }

      pausedAtRef.current = null;
    }
  }, [clearAllTimers, startTimers, performLogout]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    startTimers();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearAllTimers();
    };
  }, [handleActivity, handleVisibilityChange, startTimers, clearAllTimers]);

  return { showWarning, secondsLeft, resetTimer };
}

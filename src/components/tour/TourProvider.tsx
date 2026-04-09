import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { driver, DriveStep, Driver, Config } from "driver.js";
import "driver.js/dist/driver.css";

interface TourContextType {
  startTour: (tourId: string, steps: DriveStep[]) => void;
  hasSeenTour: (tourId: string) => boolean;
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
  isActive: boolean;
  currentTourId: string | null;
}

const TourContext = createContext<TourContextType | null>(null);

const TOUR_STORAGE_KEY = "bimaster_tours_completed";

const getCompletedTours = (): string[] => {
  try {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setCompletedTours = (tours: string[]) => {
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(tours));
};

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);

  useEffect(() => {
    // Cleanup driver instance on unmount
    return () => {
      if (driverInstance) {
        driverInstance.destroy();
      }
    };
  }, [driverInstance]);

  const hasSeenTour = useCallback((tourId: string): boolean => {
    const completed = getCompletedTours();
    return completed.includes(tourId);
  }, []);

  const markTourComplete = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    if (!completed.includes(tourId)) {
      setCompletedTours([...completed, tourId]);
    }
  }, []);

  const startTour = useCallback((tourId: string, steps: DriveStep[]) => {
    // Destroy previous instance if exists
    if (driverInstance) {
      driverInstance.destroy();
    }

    const config: Config = {
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      steps: steps,
      animate: true,
      overlayColor: "rgba(0, 0, 0, 0.75)",
      stagePadding: 10,
      stageRadius: 8,
      popoverClass: "bimaster-tour-popover",
      nextBtnText: "Próximo →",
      prevBtnText: "← Anterior",
      doneBtnText: "Concluir ✓",
      progressText: "{{current}} de {{total}}",
      onDestroyStarted: () => {
        setIsActive(false);
        setCurrentTourId(null);
        markTourComplete(tourId);
        driverObj.destroy();
      },
      onDestroyed: () => {
        setIsActive(false);
        setCurrentTourId(null);
      },
    };

    const driverObj = driver(config);
    setDriverInstance(driverObj);
    setIsActive(true);
    setCurrentTourId(tourId);
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      driverObj.drive();
    }, 300);
  }, [driverInstance, markTourComplete]);

  const resetTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    setCompletedTours(completed.filter(id => id !== tourId));
  }, []);

  const resetAllTours = useCallback(() => {
    setCompletedTours([]);
  }, []);

  return (
    <TourContext.Provider
      value={{
        startTour,
        hasSeenTour,
        resetTour,
        resetAllTours,
        isActive,
        currentTourId,
      }}
    >
      {children}
      <style>{`
        .driver-popover.bimaster-tour-popover {
          background: hsl(var(--card)) !important;
          color: hsl(var(--card-foreground)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          padding: 16px !important;
          max-width: 400px !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-title {
          font-size: 1.1rem !important;
          font-weight: 600 !important;
          color: hsl(var(--foreground)) !important;
          margin-bottom: 8px !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-description {
          font-size: 0.95rem !important;
          color: hsl(var(--muted-foreground)) !important;
          line-height: 1.5 !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-progress-text {
          font-size: 0.8rem !important;
          color: hsl(var(--muted-foreground)) !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-navigation-btns {
          gap: 8px !important;
          margin-top: 16px !important;
        }
        
        .driver-popover.bimaster-tour-popover button {
          background: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
          font-size: 0.9rem !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }
        
        .driver-popover.bimaster-tour-popover button:hover {
          opacity: 0.9 !important;
        }
        
        .driver-popover.bimaster-tour-popover button.driver-popover-prev-btn {
          background: hsl(var(--secondary)) !important;
          color: hsl(var(--secondary-foreground)) !important;
        }
        
        .driver-popover.bimaster-tour-popover button.driver-popover-close-btn {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          padding: 4px 8px !important;
          background: transparent !important;
          color: hsl(var(--muted-foreground)) !important;
          font-size: 1.2rem !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-arrow {
          border-color: hsl(var(--card)) !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-arrow-side-left {
          border-left-color: hsl(var(--card)) !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-arrow-side-right {
          border-right-color: hsl(var(--card)) !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-arrow-side-top {
          border-top-color: hsl(var(--card)) !important;
        }
        
        .driver-popover.bimaster-tour-popover .driver-popover-arrow-side-bottom {
          border-bottom-color: hsl(var(--card)) !important;
        }
      `}</style>
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

import * as React from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ScrollableTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsList> {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  ScrollableTabsListProps
>(({ className, children, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      "w-full flex overflow-x-auto scrollbar-hide sm:grid",
      className
    )}
    {...props}
  >
    {children}
  </TabsList>
));

ScrollableTabsList.displayName = "ScrollableTabsList";

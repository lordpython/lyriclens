import React from "react";
import { Music, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export interface AppLayoutProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onSidebarToggle: (open: boolean) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  sidebar,
  header,
  children,
  isSidebarOpen,
  onSidebarToggle,
}) => {
  return (
    <div className="flex flex-col md:flex-row h-dvh bg-background text-foreground font-sans overflow-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Mobile Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border/30 bg-card/80 backdrop-blur-xl md:hidden shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSidebarToggle(true)}
            className="hover:bg-primary/10"
          >
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-primary to-accent flex items-center justify-center">
              <Music className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">LyricLens</span>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
              onClick={() => onSidebarToggle(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-0 bottom-0 left-0 w-[280px] bg-card border-r border-border z-50 md:hidden"
            >
              <div className="absolute top-4 right-4 z-50">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onSidebarToggle(false)}
                  className="h-8 w-8"
                >
                  <X size={18} />
                </Button>
              </div>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-2[280px] bg-card/95 backdrop-blur-xl border-r border-border/30 flex-col h-full shrink-0 z-20 shadow-2xl shadow-black/20">
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-linear-to-br from-background via-background to-secondary/20 relative overflow-hidden min-h-0">
        {/* Desktop Toolbar */}
        {header}

        {/* Scrollable Workspace */}
        {children}
      </main>
    </div>
  );
};

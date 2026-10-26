"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

/**
 * AppShell — layout wrapper dengan sidebar collapsible dan area konten.
 * Digunakan oleh semua halaman dashboard (main + detail).
 */
export default function AppShell({ children, navbar }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="relative flex-none">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar slot */}
        {navbar}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#F4F7FB] dark:bg-[#0D1117]">
          {children}
        </main>
      </div>
    </div>
  );
}

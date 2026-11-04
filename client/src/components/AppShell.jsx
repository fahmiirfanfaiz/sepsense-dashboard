"use client";

import { useState, useEffect, cloneElement, isValidElement } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

/**
 * AppShell — layout wrapper dengan sidebar dan area konten.
 *  - Desktop (>= lg): sidebar collapsible di sisi kiri.
 *  - Tablet & Mobile (< lg): sidebar menjadi drawer off-canvas yang dibuka
 *    lewat tombol hamburger pada Navbar.
 */
export default function AppShell({ children, navbar }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Tutup drawer otomatis saat berpindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Kunci scroll body & tutup dengan tombol Escape saat drawer terbuka
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navbarEl = isValidElement(navbar)
    ? cloneElement(navbar, { onMenuClick: () => setMobileOpen(true) })
    : navbar;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <div className="relative flex-none hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      </div>

      {/* Drawer tablet / mobile */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-64 max-w-[85vw] transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar mobile onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {navbarEl}

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F4F7FB] dark:bg-[#0D1117]">
          {children}
        </main>
      </div>
    </div>
  );
}

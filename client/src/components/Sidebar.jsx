"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Stethoscope,
  FlaskConical,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi, getStoredUser } from "@/lib/api";

const ROLE_LABEL = {
  DOKTER: "Dokter",
  PERAWAT: "Perawat",
  APOTEKER: "Apoteker",
};

const ROLE_ICON = {
  DOKTER: Stethoscope,
  PERAWAT: HeartPulse,
  APOTEKER: FlaskConical,
};

const NAV_ITEMS = [
  {
    href: "/",
    label: "Main Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
];

export default function Sidebar({ collapsed: collapsedProp = false, onToggle, mobile = false, onClose }) {
  const pathname = usePathname();
  // Pada drawer mobile sidebar selalu tampil penuh
  const collapsed = mobile ? false : collapsedProp;
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const RoleIcon = ROLE_ICON[user?.role] ?? User;

  async function handleLogout() {
    await authApi.logout();
    window.location.href = "/login";
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out select-none",
        "bg-gradient-to-b from-[#0F172A] to-[#1A2744]",
        "border-r border-white/[0.06]",
        mobile ? "w-full" : collapsed ? "w-[68px]" : "w-64",
      )}
    >
      {/* Logo / Brand */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-white/[0.07]",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="shrink-0 w-8 h-8 flex items-center justify-center">
          <Image
            src="/images/logo.svg"
            alt="Sepsense Logo"
            width={28}
            height={36}
            priority
            className="object-contain w-auto h-7 drop-shadow-[0_0_12px_rgba(75,180,58,0.35)]"
          />
        </div>
        {!collapsed && (
          <span className="font-poppins font-bold text-white text-[15px] tracking-tight whitespace-nowrap">
            Sepsense
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-[#4BB43A]/20 text-[#4BB43A] shadow-[inset_0_0_0_1px_rgba(75,180,58,0.25)]"
                  : "text-white/60 hover:bg-white/[0.07] hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon
                className={cn(
                  "shrink-0 w-4.5 h-4.5 transition-colors",
                  isActive ? "text-[#4BB43A]" : "text-white/50 group-hover:text-white",
                )}
              />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div
        className={cn(
          "border-t border-white/[0.07] px-3 py-4 space-y-3",
        )}
      >
        {user && (
          <div
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "justify-center",
            )}
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#4BB43A] to-[#3A9D2C] flex items-center justify-center shadow">
              <span className="text-white text-xs font-bold font-poppins leading-none uppercase">
                {user.name?.[0] ?? "?"}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-[13px] font-semibold font-poppins truncate leading-tight">
                  {user.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <RoleIcon className="w-3 h-3 text-[#4BB43A]" />
                  <span className="text-white/50 text-[11px] font-inter">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? "Keluar" : undefined}
          className={cn(
            "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 group",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="font-inter text-[13px]">Keluar</span>}
        </button>
      </div>

      {/* Collapse Toggle (desktop) / Close (mobile drawer) */}
      {mobile ? (
        <button
          onClick={onClose}
          className="absolute top-4 right-3 w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all z-10"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="absolute top-[72px] -right-3 w-6 h-6 rounded-full bg-[#1A2744] border border-white/10 text-white/60 hover:text-white hover:border-white/30 flex items-center justify-center transition-all shadow-md z-10"
          aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { useTeacherLayout } from "@/app/(teacher)/layout";

interface NavItemProps {
  href: string;
  label: string;
  icon?: LucideIcon;
}

export function NavItem({ href, label, icon: Icon }: NavItemProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, onSidebarIconClick } = useTeacherLayout();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  const handleClick = () => {
    if (sidebarCollapsed && onSidebarIconClick) {
      onSidebarIconClick();
    }
  };

  return (
    <Link
      href={href}
      prefetch={process.env.NODE_ENV === "production" ? false : undefined}
      onClick={handleClick}
      className={`group flex items-center ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"} rounded-lg transition-colors text-left w-full ${
        isActive
          ? "bg-slate-600 text-slate-50 shadow-sm"
          : "text-slate-200 hover:bg-slate-600/80 hover:text-white"
      }`}
      title={sidebarCollapsed ? label : undefined}
    >
      {Icon && (
        <Icon
          className={`${sidebarCollapsed ? "h-5 w-5" : "h-4 w-4"} transition-colors ${
            isActive
              ? "text-blue-400"
              : "text-slate-400 group-hover:text-slate-200"
          }`}
        />
      )}
      {!sidebarCollapsed && <span className="text-sm">{label}</span>}
    </Link>
  );
}

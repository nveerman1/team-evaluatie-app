"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  label: string;
}

export function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left w-full ${
        isActive
          ? "bg-slate-600 text-slate-50 shadow-sm"
          : "text-slate-200 hover:bg-slate-600/80 hover:text-white"
      }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? "bg-blue-400" : "bg-slate-600"
        }`}
      />
      <span className="text-sm">{label}</span>
    </Link>
  );
}

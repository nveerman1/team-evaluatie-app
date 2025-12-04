"use client";

import { ReactNode } from "react";
import Link from "next/link";

type ListRowProps = {
  title: string;
  meta: string;
  right?: ReactNode;
  href?: string;
  onClick?: () => void;
};

export function ListRow({ title, meta, right, href, onClick }: ListRowProps) {
  const content = (
    <>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">{title}</div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5">{meta}</div>
      </div>
      {right && <div className="flex-shrink-0 ml-4">{right}</div>}
    </>
  );

  const className = "flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors cursor-pointer";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={`${className} w-full text-left`}>
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">{title}</div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5">{meta}</div>
      </div>
      {right && <div className="flex-shrink-0 ml-4">{right}</div>}
    </div>
  );
}

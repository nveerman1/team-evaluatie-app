"use client";

import { ReactNode } from "react";

type ListRowProps = {
  title: string;
  meta: string;
  right?: ReactNode;
};

export function ListRow({ title, meta, right }: ListRowProps) {
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

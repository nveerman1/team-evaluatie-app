"use client";

import { ReactNode } from "react";

type ListRowProps = {
  title: string;
  meta: string;
  right?: ReactNode;
};

export function ListRow({ title, meta, right }: ListRowProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
        <div className="text-xs text-gray-500 truncate">{meta}</div>
      </div>
      {right && <div className="flex-shrink-0 ml-4">{right}</div>}
    </div>
  );
}

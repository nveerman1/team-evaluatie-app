"use client";

import { useState, ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-[13px] text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span
          className={`text-gray-300 text-xs transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          }`}
        >
          ▲
        </span>
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

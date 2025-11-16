import React from "react";

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type BadgeProps = {
  color?: "blue" | "green" | "amber" | "gray";
  children: React.ReactNode;
};

export function Badge({ color = "gray", children }: BadgeProps) {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    gray: "bg-gray-50 text-gray-700 ring-gray-200",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        map[color]
      )}
    >
      {children}
    </span>
  );
}

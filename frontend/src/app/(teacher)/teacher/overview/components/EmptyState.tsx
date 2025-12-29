"use client";

import React from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = "Kies eerst een vak",
  message = "Selecteer een vak om het overzicht te laden. Daarna kun je filteren op klas, periode en leerling.",
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
        {icon && <div className="mb-4 flex justify-center">{icon}</div>}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

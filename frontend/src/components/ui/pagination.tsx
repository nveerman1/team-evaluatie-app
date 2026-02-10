import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrevious}
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
        <span>Pagina</span>
        <span className="font-semibold text-slate-900">{currentPage}</span>
        <span>van</span>
        <span className="font-semibold text-slate-900">{totalPages}</span>
      </div>

      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

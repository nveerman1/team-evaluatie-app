import React from "react";
import Link from "next/link";
import { studentStyles } from "@/styles/student-dashboard.styles";

type PageHeaderProps = {
  onRefresh?: () => void;
  onExportAll?: () => void;
};

export function PageHeader({ onRefresh, onExportAll }: PageHeaderProps) {
  return (
    <div className={studentStyles.header.container}>
      <header className={studentStyles.header.wrapper}>
        <div className={studentStyles.header.flexContainer}>
          <div className={studentStyles.header.titleSection}>
            <h1 className={studentStyles.header.title}>
              Peer-feedback resultaten
            </h1>
            <p className={studentStyles.header.subtitle}>
              Overzicht van ontvangen feedback, OMZA-scores, docentbeoordeling en groei.
            </p>
          </div>
          <div className="flex gap-2 sm:self-start">
            <Link
              href="/student"
              prefetch={process.env.NODE_ENV === "production" ? false : undefined}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="mr-2">←</span>
              Terug
            </Link>
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onRefresh}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Vernieuwen
            </button>
            <button
              type="button"
              className={studentStyles.buttons.primary + " inline-flex items-center px-3 py-2 text-sm font-medium text-white shadow-sm"}
              onClick={onExportAll}
            >
              <span className="mr-2">📄</span>
              Exporteren als PDF
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}

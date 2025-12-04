"use client";

type PillTabsProps<T extends string> = {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
};

export function PillTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: PillTabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            activeTab === tab.id
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

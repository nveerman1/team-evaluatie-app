"use client";

type ToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onFiltersClick?: () => void;
  showFiltersButton?: boolean;
};

export function Toolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onFiltersClick,
  showFiltersButton = true,
}: ToolbarProps) {
  return (
    <div className="mb-6">
      <div className="flex gap-4 p-4 border rounded-lg bg-white">
        {/* Search Field */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Zoek titel
          </label>
          <input
            type="text"
            placeholder="Zoeken..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-64 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-40 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
          >
            <option value="all">Alle</option>
            <option value="open">Open</option>
            <option value="closed">Afgesloten</option>
          </select>
        </div>

        {/* Filters Button */}
        {showFiltersButton && (
          <div className="flex flex-col justify-end">
            <button
              onClick={onFiltersClick}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

type ToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onFiltersClick?: () => void;
};

export function Toolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onFiltersClick,
}: ToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search Field */}
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          type="text"
          placeholder="Zoeken..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Status Filter Dropdown */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
      >
        <option value="all">Alle</option>
        <option value="open">Open</option>
        <option value="closed">Afgesloten</option>
      </select>

      {/* Filters Button */}
      {onFiltersClick && (
        <button
          onClick={onFiltersClick}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          Filters
        </button>
      )}
    </div>
  );
}

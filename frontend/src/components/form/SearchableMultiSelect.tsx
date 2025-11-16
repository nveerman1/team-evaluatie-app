"use client";

import { useState, useRef, useEffect } from "react";

export type SearchableOption = {
  id: number;
  label: string;
  subtitle?: string;
};

type SearchableMultiSelectProps = {
  options: SearchableOption[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
};

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Zoek en selecteer...",
  className = "",
  disabled = false,
  loading = false,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOptions = options.filter(opt => value.includes(opt.id));
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleToggleOption = (optionId: number) => {
    if (value.includes(optionId)) {
      onChange(value.filter(id => id !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  };

  const handleRemoveOption = (optionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(id => id !== optionId));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main input area */}
      <div
        onClick={() => !disabled && !loading && setIsOpen(true)}
        className={`min-h-[38px] w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-text
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
          ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}`}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {/* Selected items as chips */}
          {selectedOptions.map(opt => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded"
            >
              {opt.label}
              <button
                type="button"
                onClick={(e) => handleRemoveOption(opt.id, e)}
                className="hover:text-blue-900"
                disabled={disabled || loading}
              >
                ×
              </button>
            </span>
          ))}
          
          {/* Search input */}
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={selectedOptions.length === 0 ? placeholder : ""}
              className="flex-1 min-w-[120px] outline-none text-sm"
              disabled={disabled || loading}
            />
          ) : selectedOptions.length === 0 ? (
            <span className="text-gray-500 text-sm">{loading ? "Laden..." : placeholder}</span>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 italic">
                {searchTerm ? "Geen resultaten gevonden" : "Geen opties beschikbaar"}
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => handleToggleOption(option.id)}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className={`text-sm ${isSelected ? "font-medium text-blue-700" : ""}`}>
                          {option.label}
                        </div>
                        {option.subtitle && (
                          <div className="text-xs text-gray-600">
                            {option.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

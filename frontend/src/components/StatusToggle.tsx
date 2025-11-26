type StatusToggleOption = {
  value: string;
  label: string;
};

type StatusToggleProps = {
  options: [StatusToggleOption, StatusToggleOption];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * A two-segment toggle control for status selection.
 * Used for toggling between states like "Concept" and "Gepubliceerd".
 */
export function StatusToggle({
  options,
  value,
  onChange,
  disabled = false,
}: StatusToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 shadow-sm">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              px-4 py-1.5 text-sm font-medium rounded-md transition-all
              ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }
              ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

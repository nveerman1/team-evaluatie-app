interface TeamBadgeProps {
  teamNumber: number;
  displayName?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outlined";
}

export function TeamBadge({
  teamNumber,
  displayName,
  size = "md",
  variant = "default",
}: TeamBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const variantClasses = {
    default: "bg-blue-100 text-blue-800",
    outlined: "border border-blue-300 text-blue-700 bg-white",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${sizeClasses[size]} ${variantClasses[variant]}`}
      title={displayName || `Team ${teamNumber}`}
    >
      👥 {teamNumber}
    </span>
  );
}

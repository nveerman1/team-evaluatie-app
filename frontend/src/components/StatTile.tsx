type StatTileProps = {
  icon: string;
  label: string;
  value: number;
  bgColor?: string;
  textColor?: string;
  valueBoldColor?: string;
  onClick?: () => void;
};

export function StatTile({
  icon,
  label,
  value,
  bgColor = "bg-blue-50",
  textColor = "text-blue-700",
  valueBoldColor,
  onClick,
}: StatTileProps) {
  const Component = onClick ? "button" : "div";
  const boldColor = valueBoldColor || textColor.replace("700", "900");
  
  return (
    <Component
      onClick={onClick}
      className={`p-4 border rounded-xl ${bgColor} ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{icon}</span>
        <div className={`text-sm font-medium ${textColor}`}>{label}</div>
      </div>
      <div className={`text-3xl font-bold ${boldColor}`}>
        {value}
      </div>
    </Component>
  );
}

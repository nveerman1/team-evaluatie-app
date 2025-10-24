type TileProps = {
  label: string;
  value: number;
};

export function Tile({ label, value }: TileProps) {
  return (
    <div className="p-4 border rounded-2xl bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

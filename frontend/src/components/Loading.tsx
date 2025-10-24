type LoadingProps = {
  message?: string;
};

export function Loading({ message = "Laden…" }: LoadingProps) {
  return <div className="text-gray-500">{message}</div>;
}

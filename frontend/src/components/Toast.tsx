type ToastProps = {
  message: string;
};

export function Toast({ message }: ToastProps) {
  return (
    <div className="p-3 rounded-lg bg-gray-100 text-gray-800">{message}</div>
  );
}

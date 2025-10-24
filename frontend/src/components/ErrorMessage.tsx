type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="p-3 rounded-lg bg-red-50 text-red-700">{message}</div>
  );
}

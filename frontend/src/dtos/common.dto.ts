/**
 * Common utility types and error handling types for the application.
 */

/**
 * Standard API error response
 */
export interface ApiError {
  detail: string;
  status?: number;
}

/**
 * Type-safe error handler for API calls
 */
export class ApiException extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiException";
  }

  static fromError(error: unknown): ApiException {
    if (error instanceof ApiException) {
      return error;
    }
    if (error instanceof Error) {
      return new ApiException(error.message);
    }
    return new ApiException(String(error));
  }
}

/**
 * Generic modal component props
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}

/**
 * Generic text input props
 */
export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

/**
 * API response wrapper for consistent handling
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

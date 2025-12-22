This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Architecture

This frontend follows a well-organized architecture with clear separation of concerns. See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information about:

- Directory structure (DTOs, Services, Hooks, Components, Utils)
- Architectural patterns and best practices
- Import conventions and barrel exports
- Migration guide for updating pages

## Getting Started

### Prerequisites

Make sure the FastAPI backend is running on `http://127.0.0.1:8000` before starting the frontend.

```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### API Proxy Configuration

In development, Next.js automatically proxies `/api/v1/*` requests to the FastAPI backend at `http://127.0.0.1:8000/api/v1/*`. This is configured in `next.config.ts` using the `rewrites()` function.

In production, nginx or another reverse proxy should handle this routing.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project Structure

```
src/
├── app/           # Next.js pages (App Router)
├── dtos/          # Type definitions (Data Transfer Objects)
├── services/      # API service layer
├── hooks/         # Custom React hooks
├── components/    # Reusable UI components
├── utils/         # Helper/utility functions
└── lib/           # Core utilities (API client)
```

## Error Handling

### API Authentication Errors

The application uses a custom `ApiAuthError` class (defined in `src/lib/api.ts`) to handle authentication and authorization errors (401/403) from the API. This allows the application to:

1. **Distinguish between auth errors and other API errors** - Auth errors are thrown as `ApiAuthError` with a status code and friendly message
2. **Handle business-case 403 responses gracefully** - Some 403 responses are expected business cases (e.g., "student has not completed self-assessment yet") and are handled without logging error stacks
3. **Provide user-friendly error messages** - Auth errors include a `friendlyMessage` property that can be shown to users

#### Example Usage

In services (e.g., `student.service.ts`):
```typescript
try {
  const data = await api.get('/some-endpoint');
  return data;
} catch (error) {
  if (error instanceof ApiAuthError && error.status === 403) {
    // Handle business case 403 (e.g., return empty data with flag)
    return { data: [], needsSelfAssessment: true };
  }
  // Re-throw other errors (e.g., 401 for redirect to login)
  throw error;
}
```

In hooks (e.g., `useStudentDashboard.ts`):
```typescript
try {
  const data = await studentService.getDashboard();
  setDashboard(data);
} catch (e) {
  if (e instanceof ApiAuthError) {
    setError(e.friendlyMessage);
    // Optionally redirect to /login for 401
  }
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

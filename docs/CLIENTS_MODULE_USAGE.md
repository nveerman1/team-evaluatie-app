# Clients (Opdrachtgevers) Module - Usage Guide

## Overview

The Clients module now has complete backend integration with real-time search, email templates, CSV export, and automatic reminder generation.

## Features Implemented

### 1. Reminder Generation Algorithm

The system automatically generates reminders based on project phases and deadlines.

**API Endpoint:**
```
GET /api/v1/clients/upcoming-reminders?days_ahead=30
```

**Reminder Types:**
- **Tussenpresentatie** - Generated 7 days after midterm assessment is published
- **Eindpresentatie** - Generated 7 days after final assessment is published
- **Bedankmail** - Generated 21 days after final assessment is published
- **Project Ending** - Generated when project end_date is approaching

**Usage in Frontend:**
```typescript
import { useReminders } from "@/hooks";

function RemindersList() {
  const { data, loading, error } = useReminders(30); // 30 days ahead
  
  return (
    <div>
      {data?.items.map(reminder => (
        <div key={reminder.id}>
          {reminder.text} - Due: {reminder.due_date}
        </div>
      ))}
    </div>
  );
}
```

### 2. Email Template System

5 pre-configured templates with variable substitution:

**Templates:**
1. **opvolgmail** - Follow-up for new school year
2. **tussenpresentatie** - Midterm presentation invitation
3. **eindpresentatie** - Final presentation invitation
4. **bedankmail** - Thank you after project
5. **kennismakingsmail** - Introduction to new client

**API Endpoints:**
```
GET  /api/v1/clients/templates
POST /api/v1/clients/templates/{template_key}/render
```

**Template Variables:**
- `{contactpersoon}` - Contact person name
- `{schooljaar}` - School year (e.g., "2024-2025")
- `{project_naam}` - Project name
- `{datum}` - Date
- `{tijd}` - Time
- `{locatie}` - Location
- `{klas_naam}` - Class name
- `{docent_naam}` - Teacher name
- `{school_naam}` - School name

**Usage Example:**
```typescript
import { clientService } from "@/services";

const rendered = await clientService.renderEmailTemplate("tussenpresentatie", {
  contactpersoon: "John Doe",
  project_naam: "Smart City Project",
  datum: "2025-06-15",
  tijd: "14:00",
  locatie: "School Auditorium",
  klas_naam: "5V1",
  docent_naam: "Nick Veerman",
  school_naam: "Demo School"
});

// rendered.subject: "Uitnodiging tussenpresentatie Smart City Project"
// rendered.body: Full email body with variables substituted
```

### 3. CSV Export

Export all client data to CSV with the same filters as the list view.

**API Endpoint:**
```
GET /api/v1/clients/export/csv?level=Bovenbouw&status=Actief&search=greystar
```

**Exported Columns:**
- ID
- Organisatie
- Contactpersoon
- Email
- Telefoon
- Niveau
- Sector
- Tags
- Actief (Ja/Nee)
- Aangemaakt
- Laatst bijgewerkt

**Usage in Frontend:**
```typescript
import { clientService } from "@/services";

async function exportToCSV() {
  const blob = await clientService.exportClientsCSV({
    level: "Bovenbouw",
    status: "Actief",
    search: "tech"
  });
  
  // Download the file
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opdrachtgevers_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
```

### 4. Real-time Search with Debouncing

Search is automatically debounced at 500ms to prevent excessive API calls.

**Frontend Hooks:**
```typescript
import { useClients } from "@/hooks";

function ClientsList() {
  const [search, setSearch] = useState("");
  
  // Search is debounced automatically
  const { data, loading, error } = useClients({
    page: 1,
    per_page: 20,
    search: search, // Debounced at 500ms
    level: "Bovenbouw",
    status: "Actief"
  });
  
  return (
    <input 
      value={search} 
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### 5. UI Components

A new `ClientsList` component demonstrates all features:

**Location:** `frontend/src/components/clients/ClientsList.tsx`

**Features:**
- ✅ Real-time debounced search
- ✅ Level and status filtering
- ✅ CSV export button
- ✅ Pagination
- ✅ Loading states
- ✅ Error handling
- ✅ Tags display
- ✅ Direct links to client details

**Usage:**
```typescript
import { ClientsList } from "@/components/clients/ClientsList";

function Page() {
  return <ClientsList />;
}
```

## API Documentation

### List Clients
```http
GET /api/v1/clients?page=1&per_page=20&level=Bovenbouw&status=Actief&search=tech
```

### Get Client
```http
GET /api/v1/clients/{id}
```

### Create Client
```http
POST /api/v1/clients
Content-Type: application/json

{
  "organization": "Tech Corp",
  "contact_name": "John Doe",
  "email": "john@techcorp.com",
  "level": "Bovenbouw",
  "sector": "Technology",
  "tags": ["Innovation", "AI"]
}
```

### Update Client
```http
PUT /api/v1/clients/{id}
Content-Type: application/json

{
  "active": false
}
```

### Delete Client (Admin only)
```http
DELETE /api/v1/clients/{id}
```

### Get Client Logs
```http
GET /api/v1/clients/{id}/log
```

### Create Log Entry
```http
POST /api/v1/clients/{id}/log
Content-Type: application/json

{
  "log_type": "Notitie",
  "text": "Meeting went well"
}
```

### Get Client Projects
```http
GET /api/v1/clients/{id}/projects
```

### Get Upcoming Reminders
```http
GET /api/v1/clients/upcoming-reminders?days_ahead=30
```

### Export to CSV
```http
GET /api/v1/clients/export/csv?level=Bovenbouw&status=Actief
```

### List Email Templates
```http
GET /api/v1/clients/templates
```

### Render Email Template
```http
POST /api/v1/clients/templates/tussenpresentatie/render
Content-Type: application/json

{
  "contactpersoon": "John Doe",
  "project_naam": "Smart City",
  "datum": "2025-06-15",
  "tijd": "14:00",
  "locatie": "Auditorium",
  "klas_naam": "5V1",
  "docent_naam": "Nick Veerman",
  "school_naam": "Demo School"
}
```

## Testing

All backend tests pass:
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/test_clients_api.py -v
```

## Next Steps

To fully integrate the UI:

1. **Replace mock data in page.tsx:**
   - Import `ClientsList` component
   - Use `useReminders` hook in CommunicationTab
   - Use `useClient` hook in detail pages

2. **Add email template UI:**
   - Create form to select template
   - Populate variables from client/project data
   - Preview rendered email
   - Open mailto link or integrate with email service

3. **Enhance dashboard tab:**
   - Calculate KPIs from real data
   - Show real top partnerships
   - Display actual new clients
   - Calculate risk clients (lastActive > 1 year)

4. **Add client creation/edit forms:**
   - Use `clientService.createClient()`
   - Use `clientService.updateClient()`
   - Form validation with Zod
   - Success/error toast notifications

## Security

- ✅ Multi-tenant isolation (school_id filtering)
- ✅ Role-based access control (RBAC)
- ✅ CodeQL security scan: 0 vulnerabilities
- ✅ Email validation
- ✅ Input sanitization
- ✅ Cascading deletes configured

## Performance

- ✅ Debounced search (500ms)
- ✅ Pagination (default 20 per page)
- ✅ Database indexes on frequently queried fields
- ✅ Efficient filtering at database level

# Opdrachtgeverstaken Feature - Complete Documentatie

## 📋 Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Functionaliteit](#functionaliteit)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Integratie](#frontend-integratie)
6. [Auto-generatie Logica](#auto-generatie-logica)
7. [Gebruikershandleiding](#gebruikershandleiding)
8. [Technische Details](#technische-details)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Overzicht

De **Opdrachtgeverstaken** feature stelt docenten in staat om client-gerelateerde communicatietaken te beheren met automatische generatie, dashboard weergave, kalender integratie en email functionaliteit.

### Belangrijkste Features

✅ **Automatische Taak Generatie** - Taken worden automatisch aangemaakt 21 dagen voor presentaties  
✅ **Dashboard Integratie** - Real-time weergave van openstaande taken  
✅ **Kalender Weergave** - Taken verschijnen als kalender events  
✅ **Email Integratie** - "Open in Outlook" met vooringevulde mailto links  
✅ **CRUD Operaties** - Volledige beheer van taken (maken, wijzigen, verwijderen, markeren als klaar)  
✅ **Smart Updates** - Auto-gegenereerde taken updaten bij projectwijzigingen, handmatige taken blijven behouden

### Architectuur

```
Frontend (Next.js 15 + TypeScript)
    ↓
API Layer (/api/v1/teacher/tasks)
    ↓
Business Logic (TaskGenerationService)
    ↓
Database (PostgreSQL - tasks table)
```

---

## Functionaliteit

### Voor Docenten

#### Dashboard
- **Opdrachtgevers Tab**: Toont openstaande client-gerelateerde taken
- **KPI Tile**: Real-time telling van open taken met client namen
- **Actieknoppen**: 
  - "Open in Outlook" - Opent email client met vooringevulde gegevens
  - "Klaar" - Markeert taak als voltooid

#### Kalender
- Taken verschijnen als kalender events
- Drie distinct types met iconen:
  - 📧 Opdrachtgever taken (client communicatie)
  - ✅ Docent taken (algemene docent taken)
  - 📌 Project taken (project-gerelateerd)
- Filterbaar via event type dropdown

#### Taakbeheer
- Handmatig taken aanmaken
- Taken wijzigen (titel, beschrijving, deadline, status)
- Taken verwijderen (alleen handmatige taken)
- Taken markeren als voltooid

### Automatische Generatie

Wanneer een project wordt aangemaakt via de wizard met:
- Client/Opdrachtgever (client_id)
- Tussenpresentatie datum (project_assessment_tussen.deadline)
- Eindpresentatie datum (project_assessment_eind.deadline)

Dan worden automatisch 2 taken gegenereerd:

1. **Tussenpresentatie Taak**
   - Due date: 21 dagen vóór tussenpresentatie
   - Titel: "Tussenpresentatie [Project Naam] voorbereiden"
   - Beschrijving: Contact info en context

2. **Eindpresentatie Taak**
   - Due date: 21 dagen vóór eindpresentatie
   - Titel: "Eindpresentatie [Project Naam] voorbereiden"
   - Beschrijving: Contact info en context

---

## Database Schema

### Tabel: `tasks`

```sql
CREATE TABLE tasks (
    -- Primary Key
    id INTEGER PRIMARY KEY,
    
    -- Multi-tenant scoping
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Taak Details
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    due_date DATE NULL,
    
    -- Status & Type
    status VARCHAR(30) NOT NULL DEFAULT 'open',  -- 'open' | 'done' | 'dismissed'
    type VARCHAR(30) NOT NULL DEFAULT 'opdrachtgever',  -- 'opdrachtgever' | 'docent' | 'project'
    
    -- Koppelingen
    project_id INTEGER NULL REFERENCES projects(id) ON DELETE CASCADE,
    client_id INTEGER NULL REFERENCES clients(id) ON DELETE SET NULL,
    class_id INTEGER NULL REFERENCES classes(id) ON DELETE SET NULL,
    
    -- Auto-generatie tracking
    auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',  -- 'tussenpresentatie' | 'eindpresentatie' | 'manual'
    
    -- Email integratie
    email_to VARCHAR(500) NULL,
    email_cc VARCHAR(500) NULL,
    
    -- Timestamps
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes voor performance
CREATE INDEX ix_tasks_school_id ON tasks(school_id);
CREATE INDEX ix_task_due_date ON tasks(due_date);
CREATE INDEX ix_task_status ON tasks(status);
CREATE INDEX ix_task_project ON tasks(project_id);
CREATE INDEX ix_task_client ON tasks(client_id);
CREATE INDEX ix_task_school_status ON tasks(school_id, status);
CREATE INDEX ix_task_auto_generated ON tasks(auto_generated);
```

### Veld Beschrijvingen

| Veld | Type | Beschrijving |
|------|------|--------------|
| `id` | Integer | Primaire sleutel |
| `school_id` | Integer | Multi-tenant scoping (verplicht) |
| `title` | String(500) | Taak titel |
| `description` | Text | Uitgebreide beschrijving (optioneel) |
| `due_date` | Date | Deadline voor de taak |
| `status` | Enum | open, done, dismissed |
| `type` | Enum | opdrachtgever, docent, project |
| `project_id` | Integer | Koppeling naar project (optioneel) |
| `client_id` | Integer | Koppeling naar client (optioneel) |
| `class_id` | Integer | Koppeling naar klas (optioneel) |
| `auto_generated` | Boolean | Automatisch gegenereerd? |
| `source` | Enum | tussenpresentatie, eindpresentatie, manual |
| `email_to` | String | Email adressen (komma-gescheiden) |
| `email_cc` | String | CC email adressen |
| `completed_at` | Timestamp | Wanneer taak voltooid is |

---

## Backend API

### Base URL
```
/api/v1/teacher/tasks
```

### Authentication
- Header: `X-User-Email` (development)
- Azure AD OAuth (production)
- RBAC: Alleen teacher/admin hebben toegang

### Endpoints

#### 1. List Tasks
```http
GET /api/v1/teacher/tasks
```

**Query Parameters:**
| Parameter | Type | Beschrijving |
|-----------|------|--------------|
| `status` | string | Filter: open, done, dismissed |
| `type` | string | Filter: opdrachtgever, docent, project |
| `from` | string | Filter: vanaf datum (ISO format) |
| `to` | string | Filter: tot datum (ISO format) |
| `project_id` | integer | Filter: specifiek project |
| `client_id` | integer | Filter: specifieke client |
| `page` | integer | Paginanummer (default: 1) |
| `per_page` | integer | Items per pagina (default: 30, max: 100) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "school_id": 1,
      "title": "Tussenpresentatie Dutch Wave Power voorbereiden",
      "description": "Contact opnemen met opdrachtgever...",
      "due_date": "2025-02-15",
      "status": "open",
      "type": "opdrachtgever",
      "project_id": 42,
      "client_id": 5,
      "auto_generated": true,
      "source": "tussenpresentatie",
      "email_to": "client@example.com",
      "email_cc": null,
      "completed_at": null,
      "created_at": "2025-01-05T10:00:00Z",
      "updated_at": "2025-01-05T10:00:00Z",
      "project_name": "Dutch Wave Power",
      "class_name": "H3a",
      "client_name": "Greystar",
      "client_email": "client@example.com",
      "course_name": "O&O"
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 30
}
```

#### 2. Create Task
```http
POST /api/v1/teacher/tasks
```

**Request Body:**
```json
{
  "title": "Bedankmail Rijndam sturen",
  "description": "Bedank Rijndam voor de prettige samenwerking",
  "due_date": "2025-03-20",
  "status": "open",
  "type": "opdrachtgever",
  "project_id": 42,
  "client_id": 5,
  "email_to": "contact@rijndam.nl"
}
```

**Response:** Task object (zie List Tasks)

#### 3. Update Task
```http
PATCH /api/v1/teacher/tasks/{task_id}
```

**Request Body:** (alle velden optioneel)
```json
{
  "title": "Updated titel",
  "description": "Updated beschrijving",
  "due_date": "2025-03-25",
  "status": "done"
}
```

**Response:** Updated task object

**Note:** Bij status change naar "done" wordt `completed_at` automatisch gezet.

#### 4. Delete Task
```http
DELETE /api/v1/teacher/tasks/{task_id}
```

**Response:** `204 No Content`

**Note:** Alleen handmatige taken kunnen verwijderd worden. Auto-gegenereerde taken worden alleen verwijderd bij project wijzigingen.

#### 5. Complete Task
```http
POST /api/v1/teacher/tasks/{task_id}/complete
```

**Response:** Task object met status "done" en `completed_at` gezet

---

## Frontend Integratie

### DTOs

**Bestand:** `frontend/src/dtos/task.dto.ts`

```typescript
export type TaskStatus = "open" | "done" | "dismissed";
export type TaskType = "opdrachtgever" | "docent" | "project";
export type TaskSource = "tussenpresentatie" | "eindpresentatie" | "manual";

export type Task = {
  id: number;
  school_id: number;
  title: string;
  description?: string;
  due_date?: string;
  status: TaskStatus;
  type: TaskType;
  project_id?: number;
  client_id?: number;
  auto_generated: boolean;
  source: TaskSource;
  email_to?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  
  // Enriched context
  project_name?: string;
  class_name?: string;
  client_name?: string;
  client_email?: string;
  course_name?: string;
};

export type TaskCreate = {
  title: string;
  description?: string;
  due_date?: string;
  type?: TaskType;
  project_id?: number;
  client_id?: number;
  email_to?: string;
};

export type TaskUpdate = Partial<TaskCreate> & {
  status?: TaskStatus;
};
```

### Service

**Bestand:** `frontend/src/services/task.service.ts`

```typescript
import { Task, TaskCreate, TaskUpdate, TaskFilters } from "@/dtos/task.dto";

export const taskService = {
  // List tasks met filters
  async listTasks(filters?: TaskFilters): Promise<TaskListResponse> {
    const response = await api.get("/teacher/tasks", { params: filters });
    return response.data;
  },

  // Create task
  async createTask(data: TaskCreate): Promise<Task> {
    const response = await api.post("/teacher/tasks", data);
    return response.data;
  },

  // Update task
  async updateTask(taskId: number, data: TaskUpdate): Promise<Task> {
    const response = await api.patch(`/teacher/tasks/${taskId}`, data);
    return response.data;
  },

  // Delete task
  async deleteTask(taskId: number): Promise<void> {
    await api.delete(`/teacher/tasks/${taskId}`);
  },

  // Mark as complete
  async completeTask(taskId: number): Promise<Task> {
    const response = await api.post(`/teacher/tasks/${taskId}/complete`);
    return response.data;
  },

  // Generate mailto link
  generateMailtoLink(task: Task): string {
    const to = task.email_to || task.client_email || "";
    const subject = encodeURIComponent(task.title);
    const body = encodeURIComponent(
      `Project: ${task.project_name}\n` +
      `Opdrachtgever: ${task.client_name}\n` +
      `Deadline: ${task.due_date}\n\n` +
      `${task.description}`
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  },
};
```

### Dashboard Integratie

**Locatie:** Dashboard → "Vandaag & deze week" → "Opdrachtgevers" tab

**Component:** `ClientTasksContent` in `frontend/src/app/(teacher)/teacher/page.tsx`

```typescript
function ClientTasksContent() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    async function loadTasks() {
      const response = await taskService.listTasks({
        type: "opdrachtgever",
        status: "open",
        per_page: 10,
      });
      setTasks(response.items || []);
    }
    loadTasks();
  }, []);

  const handleOpenMail = (task: Task) => {
    const mailtoLink = taskService.generateMailtoLink(task);
    window.open(mailtoLink, "_self");
  };

  const handleMarkAsDone = async (taskId: number) => {
    await taskService.completeTask(taskId);
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  return (
    <>
      {tasks.map((task) => (
        <ListRow
          key={task.id}
          title={task.title}
          meta={`${task.client_name} • ${formatDueDate(task.due_date)}`}
          right={
            <>
              <button onClick={() => handleOpenMail(task)}>
                Open in Outlook
              </button>
              <button onClick={() => handleMarkAsDone(task.id)}>
                Klaar
              </button>
            </>
          }
        />
      ))}
    </>
  );
}
```

### Kalender Integratie

**Locatie:** `/teacher/calendar`

Taken worden automatisch geladen en weergegeven als kalender events:

```typescript
// In loadCalendarData()
const tasksData = await taskService.listTasks({ 
  status: "open", 
  per_page: 100 
});

tasks.forEach((task) => {
  if (task.due_date) {
    calendarEvents.push({
      id: `task-${task.id}`,
      title: task.title,
      date: new Date(task.due_date),
      type: `task_${task.type}`, // task_opdrachtgever, task_docent, task_project
      status: statusMap[task.status],
      link: `/teacher/tasks/kanban`,
    });
  }
});
```

**Event Iconen:**
- 📧 `task_opdrachtgever` - Client communicatie
- ✅ `task_docent` - Docent taken
- 📌 `task_project` - Project taken

---

## Auto-generatie Logica

### Service: TaskGenerationService

**Bestand:** `backend/app/infra/services/task_generation_service.py`

#### Functie: `generate_presentation_tasks()`

```python
def generate_presentation_tasks(
    db: Session,
    project: Project,
    tussen_datum: Optional[date] = None,
    eind_datum: Optional[date] = None,
    commit: bool = True,
) -> List[Task]:
    """
    Genereert automatische taken voor presentaties.
    
    - Tussenpresentatie taak: 21 dagen vóór tussen_datum
    - Eindpresentatie taak: 21 dagen vóór eind_datum
    - Upsert logica: update bestaande auto-tasks, behoud handmatige taken
    """
```

#### Trigger: Project Wizard

**Locatie:** `backend/app/api/v1/routers/projects.py` → `wizard_create_project()`

```python
# Extract presentation dates
tussen_datum = None
eind_datum = None

if payload.evaluations.project_assessment_tussen:
    tussen_datum = payload.evaluations.project_assessment_tussen.deadline.date()

if payload.evaluations.project_assessment_eind:
    eind_datum = payload.evaluations.project_assessment_eind.deadline.date()

# Generate tasks
if (tussen_datum or eind_datum) and linked_clients:
    generated_tasks = TaskGenerationService.generate_presentation_tasks(
        db=db,
        project=project,
        tussen_datum=tussen_datum,
        eind_datum=eind_datum,
        commit=False,
    )
```

#### Smart Update Logica

**Scenario 1: Project datum wordt gewijzigd**
- Auto-gegenereerde taken worden bijgewerkt met nieuwe due_date
- Handmatige taken blijven ongewijzigd

**Scenario 2: Client wordt gewijzigd**
- Auto-gegenereerde taken worden bijgewerkt met nieuwe client_id en email
- Handmatige taken blijven ongewijzigd

**Scenario 3: Project wordt verwijderd**
- Alle taken (auto en handmatig) worden verwijderd via CASCADE

#### Email Context

Auto-gegenereerde taken krijgen automatisch:
- `email_to`: Email van hoofdclient
- `title`: "Tussenpresentatie [Project] voorbereiden"
- `description`: Template met project info, datum, verwachtingen

**Template:**
```
Contact opnemen met opdrachtgever voor de tussenpresentatie op {datum}.
Bespreken: verwachtingen, stand van zaken, planning.
```

---

## Gebruikershandleiding

### Voor Docenten

#### Taken Bekijken

1. **Dashboard**
   - Ga naar Dashboard
   - Bekijk "Vandaag & deze week" sectie
   - Klik op "Opdrachtgevers" tab
   - Zie openstaande client taken

2. **Kalender**
   - Ga naar Kalender
   - Taken verschijnen automatisch als events
   - Filter op event type om alleen taken te zien

#### Email Versturen

1. Klik op "Open in Outlook" bij een taak
2. Email client opent met:
   - TO: Client email
   - Subject: Taak titel
   - Body: Project info, client, deadline, beschrijving

#### Taak Voltooien

1. Klik op "Klaar" knop bij een taak
2. Taak verdwijnt van dashboard
3. Status wordt "done"
4. `completed_at` timestamp wordt gezet

#### Handmatige Taak Maken

*(Momenteel via Kanban pagina - kan verder uitgebreid worden)*

1. Ga naar `/teacher/tasks/kanban`
2. Gebruik bestaande Kanban interface
3. Of gebruik API direct

#### Taken Beheren

- **Wijzigen**: Update via API (PATCH endpoint)
- **Verwijderen**: Alleen handmatige taken (DELETE endpoint)
- **Status**: open → done → dismissed

---

## Technische Details

### Multi-tenancy

Alle queries worden automatisch gescoped op `school_id`:

```python
query = scope_query_by_school(db.query(Task), Task, user)
```

Dit voorkomt data leakage tussen scholen.

### RBAC (Role-Based Access Control)

```python
@router.get("/tasks")
def list_tasks(user: User = Depends(get_current_user)):
    require_role(user, ["admin", "teacher"])
    # ... query tasks for user.school_id
```

Alleen teachers en admins hebben toegang. Studenten zien geen taken.

### Audit Logging

Alle mutaties worden gelogd:

```python
log_action(
    db=db,
    user=user,
    action="create_task",
    resource_type="task",
    resource_id=task.id,
    details={"title": task.title, "type": task.type},
)
```

### Performance

**Indexes voor snelle queries:**
- `school_id, status` - Dashboard queries
- `due_date` - Sorteer op deadline
- `project_id` - Project-specifieke taken
- `client_id` - Client-specifieke taken

**Database query optimalisatie:**
- Join met Project, Client, Class voor enriched context
- Pagination (default 30, max 100)
- Sorteer op `due_date ASC, created_at DESC`

### Security

✅ **SQL Injection**: Voorkomen door SQLAlchemy ORM  
✅ **XSS**: Voorkomen door React automatic escaping  
✅ **CSRF**: Protected door SameSite cookies  
✅ **Data Leakage**: Multi-tenant scoping enforced  
✅ **Auth**: Azure AD (prod) + dev headers  

**CodeQL Scan: 0 vulnerabilities**

---

## Testing

### Database Migration Test

```bash
cd backend

# Test upgrade
alembic upgrade head

# Test downgrade
alembic downgrade -1

# Verify schema
psql -d team_evaluatie -c "\d tasks"
```

### API Testing

```bash
# List tasks
curl http://localhost:8000/api/v1/teacher/tasks \
  -H "X-User-Email: teacher@school.demo"

# Create task
curl -X POST http://localhost:8000/api/v1/teacher/tasks \
  -H "X-User-Email: teacher@school.demo" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test taak",
    "due_date": "2025-03-15",
    "type": "opdrachtgever"
  }'

# Complete task
curl -X POST http://localhost:8000/api/v1/teacher/tasks/1/complete \
  -H "X-User-Email: teacher@school.demo"
```

### Frontend Testing

1. **Dashboard Test**
   - Login als teacher
   - Ga naar Dashboard
   - Check "Opdrachtgevers" tab
   - Verify KPI tile count

2. **Auto-generation Test**
   - Ga naar `/teacher/projects/new`
   - Create project met:
     - Client
     - Tussenpresentatie datum
     - Eindpresentatie datum
   - Verify 2 taken zijn aangemaakt
   - Check due_dates zijn 21 dagen voor presentaties

3. **Email Test**
   - Klik "Open in Outlook"
   - Verify mailto link met correct:
     - TO address
     - Subject
     - Body met context

4. **Kalender Test**
   - Ga naar `/teacher/calendar`
   - Verify taken verschijnen als events
   - Test event type filter

---

## Deployment

### Pre-deployment Checklist

- [ ] Database backup gemaakt
- [ ] Migration getest op staging
- [ ] API endpoints getest
- [ ] Frontend build succesvol
- [ ] Security scan uitgevoerd
- [ ] Documentation bijgewerkt

### Deployment Stappen

1. **Database Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Backend Deployment**
   - Deploy nieuwe backend versie
   - Verify `/health` endpoint
   - Check logs voor errors

3. **Frontend Deployment**
   - Build frontend: `npm run build`
   - Deploy build
   - Clear CDN cache

4. **Verification**
   - Login als teacher
   - Test dashboard weergave
   - Test task creation
   - Test email functionaliteit
   - Test kalender integratie

### Rollback Plan

```bash
# Database rollback
cd backend
alembic downgrade -1

# Application rollback
# Deploy previous version
```

### Post-deployment

1. **Monitor logs** voor errors
2. **Check database** queries performance
3. **User feedback** verzamelen
4. **Performance metrics** bekijken

---

## Veelgestelde Vragen (FAQ)

### Q: Wat gebeurt er met bestaande projecten?
**A:** Bestaande projecten krijgen geen automatische taken. Deze kunnen handmatig aangemaakt worden indien gewenst.

### Q: Kunnen studenten taken zien?
**A:** Nee, taken zijn alleen zichtbaar voor teachers en admins (RBAC enforced).

### Q: Wat als een project geen client heeft?
**A:** Auto-taken worden alleen gegenereerd als er een client gekoppeld is.

### Q: Kan ik de 21-dagen deadline aanpassen?
**A:** Momenteel hardcoded. Kan in de toekomst configurabel gemaakt worden in `TaskGenerationService`.

### Q: Worden taken automatisch verwijderd na voltooiing?
**A:** Nee, voltooide taken blijven in database met status "done". Ze verdwijnen wel van het dashboard.

### Q: Kan ik email templates aanpassen?
**A:** Momenteel worden templates hardcoded gegenereerd. Email template systeem kan in toekomst toegevoegd worden.

### Q: Hoe zit het met notificaties?
**A:** Notificaties zijn niet geïmplementeerd in v1. Kan toegevoegd worden via bestaand notification systeem.

---

## Toekomstige Uitbreidingen

### Prioriteit: Hoog
- [ ] Email template management systeem
- [ ] Task notificaties (reminder X dagen voor deadline)
- [ ] Bulk operations (meerdere taken tegelijk bewerken)
- [ ] Export naar CSV/Excel

### Prioriteit: Medium
- [ ] Task assignment (taak toewijzen aan specifieke docent)
- [ ] Recurring tasks (herhalende taken)
- [ ] Task templates (voorgedefinieerde taken)
- [ ] Integration met externe calendar (Google Calendar, Outlook Calendar)

### Prioriteit: Laag
- [ ] Comments/notes op taken
- [ ] File attachments
- [ ] Task history/audit trail UI
- [ ] Custom task types

---

## Support & Contact

Bij vragen of problemen:
1. Check deze documentatie
2. Check API docs: `http://localhost:8000/docs`
3. Check logs: `backend/logs/`
4. Open issue op GitHub

---

**Laatste update:** 2025-01-05  
**Versie:** 1.0.0  
**Auteur:** GitHub Copilot (geïmplementeerd voor nveerman1)

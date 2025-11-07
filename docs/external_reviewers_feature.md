# External Reviewer Feature - Implementation Guide

## Overview

This feature allows students and teachers to invite external reviewers (e.g., project supervisors, coaches, clients) to assess student competencies via secure, token-based magic links. External assessments are aggregated and displayed alongside self, peer, and teacher assessments.

## Architecture

### Database Models

1. **CompetencyExternalInvite**
   - Stores invitation metadata
   - Uses token hashing (SHA-256) for security
   - Tracks status: pending, used, revoked, expired
   - Includes rubric snapshot (frozen at creation time)

2. **CompetencyExternalScore**
   - Stores individual scores from external reviewers
   - Linked to invite and competency
   - Includes optional comments and reviewer details

### API Endpoints

#### Authenticated Endpoints (Student/Teacher)

- `POST /api/v1/competencies/external/invites` - Create invites
- `GET /api/v1/competencies/external/invites` - List invites (filtered by role)
- `DELETE /api/v1/competencies/external/invites/{id}` - Revoke invite

#### Public Endpoints (No Authentication)

- `GET /api/v1/competencies/external/public/invite/{token}` - Get invite info
- `POST /api/v1/competencies/external/public/submit` - Submit scores

### Frontend Components

1. **Public Submission Page** (`/external/review/[token]`)
   - Clean, minimal interface for external reviewers
   - Shows window title and student name (based on settings)
   - Score input (1-5 scale) with optional comments
   - Privacy notice and consent information

2. **ExternalInviteModal**
   - Modal for creating invites
   - Multi-email input support
   - Optional reviewer name/organization
   - Privacy warnings

3. **ExternalInviteList**
   - Tabular view of invites
   - Status badges (pending, used, revoked, expired)
   - Revoke functionality

## Configuration

### Window Settings

Configure external feedback settings in the `CompetencyWindow.settings` JSON field:

```typescript
{
  allow_external_feedback: boolean,        // Enable/disable feature per window
  max_invites_per_subject: number,        // Max invites per student (default: 3)
  invite_ttl_days: number,                // Invite expiry in days (default: 14)
  show_subject_name_to_external: string,  // "full" | "partial" | "none"
  show_external_names_to_teacher: boolean,// Show reviewer identity to teacher
  external_instructions: string,          // Custom instructions for reviewers
  external_weight: number                 // Score weighting (default: 1.0)
}
```

### Default Values

- `max_invites_per_subject`: 3
- `invite_ttl_days`: 14
- `show_subject_name_to_external`: "full"
- `show_external_names_to_teacher`: false
- `external_weight`: 1.0

## Security Features

### Token Security
- Tokens are generated using `secrets.token_urlsafe(32)` (256-bit entropy)
- Tokens are hashed with SHA-256 before storage
- Original tokens are never stored in the database
- Tokens are single-use and time-limited

### Access Control
- Students can only create invites for themselves
- Teachers can create invites for any student
- Students can only view their own invites
- Teachers can view all invites in their school
- Revocation is role-based

### Privacy
- External reviewers see minimal information (configurable)
- Student names can be masked (full/partial/none)
- External scores are aggregated for student view
- Individual external assessments visible to teachers only (optional)

## User Flows

### Student Flow

1. Navigate to competency window
2. Click "Invite External Reviewers"
3. Enter email addresses (1-10)
4. Optionally add reviewer name/organization
5. Submit invitations
6. View invite status list
7. Optionally revoke pending invites
8. View aggregated external scores in overview

### External Reviewer Flow

1. Receive email with magic link
2. Click link to open public submission page
3. View minimal context (window, student, competencies)
4. Rate each competency (1-5 scale)
5. Add optional comments
6. Optionally provide name/organization
7. Submit assessment
8. See confirmation page

### Teacher Flow

1. View "Invitations" tab in window detail
2. See all invites with status
3. Optionally create invites for students
4. View aggregated external scores in student detail
5. Export data with external scores included

## Integration Points

### Student Pages
- Add "Invite External" button to competency window card
- Display external score count in overview
- Show external aggregate in score breakdown

### Teacher Pages
- Add "Invitations" tab to window detail page
- Show external scores in student overview
- Include external column in class heatmap
- Add external scores to exports

## Future Enhancements

### Phase 2 (Not Implemented)
- [ ] Email integration (SMTP service for sending invites)
- [ ] Automated reminder emails (3 days before expiry)
- [ ] Rate limiting on public submit endpoint
- [ ] Bot protection (Turnstile/hCaptcha)
- [ ] Audit logging for compliance
- [ ] Batch operations (bulk revoke, bulk remind)
- [ ] Advanced analytics (response rates, time-to-complete)
- [ ] Custom weighting per rater type
- [ ] Export formats (CSV, PDF with external data)

### Optional Features
- [ ] 2FA light (6-digit PIN in email)
- [ ] Custom rubric per invite (override window rubric)
- [ ] File attachments from external reviewers
- [ ] Multi-language support for public page
- [ ] Anonymous feedback option
- [ ] Invitation templates

## Testing

### Manual Testing Checklist

Backend:
- [ ] Create invite as student (own ID only)
- [ ] Create invite as teacher (any student)
- [ ] Verify token hashing works
- [ ] Test invite expiry logic
- [ ] Test status transitions (pending → used/revoked/expired)
- [ ] Verify invite limits per subject
- [ ] Test rubric snapshot freezing
- [ ] Test public invite info endpoint
- [ ] Test public submit endpoint
- [ ] Verify external scores in overview
- [ ] Test revocation

Frontend:
- [ ] Open external invite modal
- [ ] Add/remove email fields
- [ ] Submit valid invites
- [ ] Handle validation errors
- [ ] View invite list with statuses
- [ ] Revoke invite
- [ ] Open public link
- [ ] Submit external assessment
- [ ] Verify success page
- [ ] Test expired/revoked links
- [ ] View external scores in overview

### Edge Cases
- [ ] Duplicate email addresses
- [ ] Invalid token
- [ ] Expired invite
- [ ] Revoked invite
- [ ] Window closed after invite sent
- [ ] Competency rubric changed after invite
- [ ] Reaching invite limit
- [ ] Submitting incomplete assessment
- [ ] Network errors during submission

## Database Migration

Run the migration to create the required tables:

```bash
cd backend
alembic upgrade head
```

The migration creates:
- `competency_external_invites` table
- `competency_external_scores` table
- Associated indexes and foreign keys

## API Examples

### Create Invites

```bash
POST /api/v1/competencies/external/invites
Content-Type: application/json
Authorization: Bearer <token>

{
  "window_id": 1,
  "subject_user_id": 5,
  "emails": ["coach@example.com", "supervisor@company.com"],
  "external_name": "Project Supervisor",
  "external_organization": "ABC Company"
}
```

### Submit External Assessment

```bash
POST /api/v1/competencies/external/public/submit
Content-Type: application/json

{
  "token": "abc123...",
  "scores": [
    {
      "competency_id": 1,
      "score": 4,
      "comment": "Strong communication skills"
    },
    {
      "competency_id": 2,
      "score": 5,
      "comment": "Excellent teamwork"
    }
  ],
  "reviewer_name": "John Doe",
  "reviewer_organization": "ABC Company"
}
```

## Troubleshooting

### Invites Not Sending
- Check SMTP configuration (when implemented)
- Verify email addresses are valid
- Check server logs for errors
- Verify window settings allow external feedback

### Public Link Not Working
- Verify token is correct (full URL)
- Check if invite is expired/revoked
- Verify invite status in database
- Check network connectivity

### Scores Not Appearing
- Verify submission was successful
- Check invite status is "used"
- Refresh student overview page
- Check database for external scores

## Support

For issues or questions, contact the development team or create an issue in the repository.

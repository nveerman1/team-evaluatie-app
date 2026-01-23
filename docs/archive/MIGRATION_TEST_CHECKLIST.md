# Migration Testing - Quick Checklist

## ✅ Essential Tests (Run These First)

### 1. Basic Functionality
- [ ] Backend server starts without errors
- [ ] Login as student - can see enrolled courses only
- [ ] Login as teacher - can see assigned courses only
- [ ] Login as admin - can see all courses

### 2. Student Enrollment
- [ ] Add new student to course: `POST /api/v1/courses/{id}/students`
- [ ] List students in course: `GET /api/v1/courses/{id}/students`
- [ ] Student appears in course roster after enrollment

### 3. Project Teams
- [ ] Create project with team assignments
- [ ] View project team members
- [ ] Team information displays correctly in project views

### 4. Assessments
- [ ] Create project assessment for a team
- [ ] View assessment - team members listed correctly
- [ ] Create peer evaluation - all enrolled students included

### 5. Access Control
- [ ] Student CANNOT access non-enrolled course (403 error)
- [ ] Student CAN access enrolled course materials
- [ ] Teacher CAN access assigned courses only

---

## 🔧 Database Verification

```bash
# Connect to your database
psql -U your_user -d your_database

# Verify tables dropped
\dt groups
\dt group_members
# Both should show: "Did not find any relation"

# Check CourseEnrollment exists and has data
SELECT COUNT(*) FROM course_enrollments WHERE active = true;

# Check ProjectTeam exists and has data
SELECT COUNT(*) FROM project_teams;
```

---

## 🧪 Quick API Tests (using curl or Postman)

### Test 1: List Courses (as student)
```bash
curl -X GET "http://localhost:8000/api/v1/courses" \
  -H "Authorization: Bearer {student_token}"
```
**Expected:** Only enrolled courses returned

### Test 2: List Course Students (as teacher)
```bash
curl -X GET "http://localhost:8000/api/v1/courses/1/students" \
  -H "Authorization: Bearer {teacher_token}"
```
**Expected:** All enrolled students listed

### Test 3: Add Student to Course
```bash
curl -X POST "http://localhost:8000/api/v1/courses/1/students" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newstudent@school.com",
    "name": "New Student",
    "class_name": "4A",
    "team_number": 1
  }'
```
**Expected:** Student enrolled, CourseEnrollment created

### Test 4: Get OMZA Data
```bash
curl -X GET "http://localhost:8000/api/v1/omza/evaluations/1/data" \
  -H "Authorization: Bearer {teacher_token}"
```
**Expected:** All enrolled students included in response

---

## 🚨 Critical Paths to Test

1. **Student enrollment flow**
   - Add student → Student logs in → Sees course → Can access materials

2. **Project assessment flow**
   - Create project → Assign teams → Create assessment → View results

3. **Peer evaluation flow**
   - Create evaluation → Generate allocations → Students complete → View results

4. **External assessment flow**
   - Configure external assessment → Send invitations → External submits → View results

---

## ⚠️ Known Changes (Expected Behavior)

1. **Team info in student_overview**: `team_id` and `team_name` will be `null`
   - This is expected - teams now only exist in project context
   - Not a bug!

2. **No "default groups"**: Students are enrolled directly in courses
   - Old: Student → GroupMember → Group → Course
   - New: Student → CourseEnrollment → Course

3. **Team rosters from ProjectTeam**: All team queries use immutable ProjectTeam
   - Teams are snapshots per project
   - No longer course-wide mutable teams

---

## 📊 Success Indicators

✅ **Migration successful if:**
- No 500 errors when accessing any endpoint
- Students can enroll and access courses
- Project teams display correctly
- Assessments work for both projects and peer evaluations
- All enrolled students appear in rosters
- Access control works (students can't access non-enrolled courses)

❌ **Issues to watch for:**
- Missing students in course rosters
- Empty team member lists in projects
- 403/404 errors for enrolled students
- Broken assessment creation
- External assessment invitation failures

---

## 🐛 Debugging Tips

If something doesn't work:

1. **Check backend logs**
   ```bash
   # Look for errors mentioning Group or GroupMember
   tail -f backend/logs/app.log | grep -i "group"
   ```

2. **Check database**
   ```sql
   -- Verify enrollments exist
   SELECT * FROM course_enrollments WHERE student_id = {user_id};
   
   -- Check project teams
   SELECT * FROM project_teams WHERE project_id = {project_id};
   ```

3. **Common issues:**
   - Missing CourseEnrollment → Re-add student to course
   - Empty ProjectTeam → Recreate project team assignments
   - Old data references groups → Check if assessment uses old data

---

## 📝 Report Issues

If you find bugs, note:
1. What you were trying to do
2. What endpoint/page you were on
3. Your user role (student/teacher/admin)
4. Error message or unexpected behavior
5. Any relevant IDs (course_id, user_id, etc.)

---

**Quick Start:** Run items 1-5 under "Essential Tests" first. If those pass, the migration is working correctly for core functionality.

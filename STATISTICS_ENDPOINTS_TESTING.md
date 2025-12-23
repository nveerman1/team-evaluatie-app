# Statistics Endpoints Testing Guide

## Overview
This document provides curl examples for testing the new statistics endpoints in the 3de-blok module.

All endpoints require authentication (teacher or admin role).

## Authentication
First, get an authentication token (assuming you have dev-login enabled):
```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher1@school1.demo","password":"demo123"}'

# Extract the token from the response and set it as an environment variable
export TOKEN="your_token_here"
```

## Endpoints

### 1. List Courses
Get list of courses for dropdown filters.

```bash
curl -X GET "http://localhost:8000/api/v1/attendance/courses" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "name": "O&O",
    "code": "OO"
  },
  {
    "id": 2,
    "name": "XPLR",
    "code": "XPLR"
  }
]
```

### 2. Get Summary Statistics
Get school vs external work breakdown.

```bash
# Last 4 weeks (default)
curl -X GET "http://localhost:8000/api/v1/attendance/stats/summary?period=4w" \
  -H "Authorization: Bearer $TOKEN"

# With course filter
curl -X GET "http://localhost:8000/api/v1/attendance/stats/summary?period=4w&course_id=1" \
  -H "Authorization: Bearer $TOKEN"

# With project filter
curl -X GET "http://localhost:8000/api/v1/attendance/stats/summary?period=4w&project_id=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "school_minutes": 2400,
  "school_blocks": 32.0,
  "extern_approved_minutes": 600,
  "extern_approved_blocks": 8.0,
  "total_blocks": 40.0,
  "school_percentage": 80.0,
  "extern_percentage": 20.0
}
```

### 3. Get Weekly Trend Data
Get weekly attendance data for trend chart.

```bash
curl -X GET "http://localhost:8000/api/v1/attendance/stats/weekly?period=4w" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "week_start": "2024-01-01",
    "total_blocks": 45.5,
    "school_blocks": 38.2,
    "extern_blocks": 7.3
  },
  {
    "week_start": "2024-01-08",
    "total_blocks": 42.1,
    "school_blocks": 35.0,
    "extern_blocks": 7.1
  }
]
```

### 4. Get Daily Unique Students
Get daily unique student count.

```bash
curl -X GET "http://localhost:8000/api/v1/attendance/stats/daily?period=4w" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "date": "2024-01-15",
    "unique_students": 25
  },
  {
    "date": "2024-01-16",
    "unique_students": 28
  }
]
```

### 5. Get Heatmap Data
Get aggregated hourly heatmap data (Mon-Fri, 8:00-18:00).

```bash
curl -X GET "http://localhost:8000/api/v1/attendance/stats/heatmap?period=4w" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "cells": [
    {
      "weekday": 0,
      "hour": 8,
      "avg_students": 5.2,
      "label": "ma 08:00"
    },
    {
      "weekday": 0,
      "hour": 9,
      "avg_students": 12.8,
      "label": "ma 09:00"
    }
  ]
}
```

### 6. Get Signals/Anomalies
Get students that match anomaly criteria.

```bash
curl -X GET "http://localhost:8000/api/v1/attendance/stats/signals?period=4w" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "extern_low_school": [
    {
      "student_id": 10,
      "student_name": "Jan de Vries",
      "course": "O&O",
      "value_text": "extern 6.5u / school 1.2 blok"
    }
  ],
  "many_pending": [
    {
      "student_id": 12,
      "student_name": "Lisa Janssen",
      "course": "XPLR",
      "value_text": "pending 4"
    }
  ],
  "long_open": [
    {
      "student_id": 15,
      "student_name": "Tom Bakker",
      "course": "O&O",
      "value_text": "open sinds 15-01 09:15"
    }
  ]
}
```

### 7. Get Top & Bottom Engagement
Get top 5 and bottom 5 students by engagement.

```bash
# Last 4 weeks mode (always)
curl -X GET "http://localhost:8000/api/v1/attendance/stats/top-bottom?period=4w&mode=4w" \
  -H "Authorization: Bearer $TOKEN"

# Scope mode (uses selected period)
curl -X GET "http://localhost:8000/api/v1/attendance/stats/top-bottom?period=8w&mode=scope" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "top": [
    {
      "student_id": 20,
      "student_name": "Emma Smit",
      "course": "O&O",
      "total_blocks": 52.5
    },
    {
      "student_id": 21,
      "student_name": "Noah van Dam",
      "course": "XPLR",
      "total_blocks": 48.3
    }
  ],
  "bottom": [
    {
      "student_id": 50,
      "student_name": "Sophie de Jong",
      "course": "O&O",
      "total_blocks": 8.5
    },
    {
      "student_id": 51,
      "student_name": "Liam Peters",
      "course": "XPLR",
      "total_blocks": 10.2
    }
  ]
}
```

## Query Parameters

### period
- **Values**: `4w`, `8w`, `all`
- **Default**: `4w`
- **Description**: Time period for filtering data

### course_id
- **Type**: Integer (optional)
- **Description**: Filter by specific course

### project_id
- **Type**: Integer (optional)
- **Description**: Filter by specific project

### mode (only for top-bottom)
- **Values**: `4w`, `scope`
- **Default**: `4w`
- **Description**: 
  - `4w`: Always uses last 4 weeks
  - `scope`: Uses the selected period parameter

## Response Codes

- **200 OK**: Successful request
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: User does not have teacher/admin role
- **422 Unprocessable Entity**: Invalid query parameters
- **500 Internal Server Error**: Server error

## Notes

1. All endpoints require teacher or admin authentication
2. Data is automatically scoped to the user's school
3. Period validation ensures only valid values (`4w`, `8w`, `all`) are accepted
4. Blocks are calculated as: `seconds / (75 * 60)` where 75 minutes = 1 block
5. Heatmap only includes weekdays (Monday-Friday) and hours 8-18
6. Signals have predefined thresholds:
   - Extern/school: ≥4 hours external AND ≤2 blocks school
   - Pending: ≥3 pending external registrations
   - Long open: ≥12 hours without check-out

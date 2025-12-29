# Backend API Documentation

## Base URL
`http://localhost:8000`

## Authentication
All endpoints require a Bearer Token in the `Authorization` header.

## Deployment Controller
Base path: `/api/v1/deploy`

### 1. Trigger Deployment
Trigger a new deployment or update an existing one for a student project.

- **Method**: `POST`
- **Path**: `/{student_code}`
- **Parameters**:
  - `student_code` (path): Unique identifier for the student (e.g., `s2025_001`).
- **Body**:
  ```json
  {
    "image": "registry.hydrosim.cn/gd/s2025_001:v1",
    "project_type": "gd" // or "cd"
  }
  ```
- **Response** (202 Accepted):
  ```json
  {
    "status": "created", // or "updated"
    "message": "Project student-s2025_001 successfully created",
    "url": "http://s2025_001.gd.hydrosim.cn"
  }
  ```

### 2. Get Deployment Status
Query the real-time status of a student project deployment.

- **Method**: `GET`
- **Path**: `/{student_code}`
- **Query Parameters**:
  - `project_type`: `gd` or `cd` (Required to locate namespace)
- **Response** (200 OK):
  ```json
  {
    "status": "running", // running, deploying, stopped, error
    "detail": "Ready: 1/1",
    "ready_replicas": 1
  }
  ```

### 3. List All Resources
List all Kubernetes deployments found in the managed namespaces (`students-gd`, `students-cd`). This provides a cluster-level view independent of the database.

- **Method**: `GET`
- **Path**: `/resources/list`
- **Response** (200 OK):
  ```json
  [
    {
      "student_code": "s2025_001",
      "project_type": "gd",
      "namespace": "students-gd",
      "deployment_name": "student-s2025_001",
      "image": "registry.hydrosim.cn/gd/s2025_001:v1",
      "replicas": "1/1",
      "status": "Running",
      "created_at": "2025-12-27T01:00:00Z"
    }
  ]
  ```

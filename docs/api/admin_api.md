# Admin Portal API Specification

Base URL: `/api/v1/admin`

## Authentication
All endpoints require a valid JWT token with `is_superadmin=True` claim (or verified against User DB).

## 1. Project Management

### List All Projects (Global)
Get a paginated list of all student projects across the system.

- **URL**: `/projects`
- **Method**: `GET`
- **Query Params**:
  - `page` (int, default=1): Page number.
  - `page_size` (int, default=20): Items per page.
  - `status` (string, optional): Filter by deployment status (e.g., `running`, `stopped`).
  - `search` (string, optional): Search by project name or owner username.

- **Success Response (200 OK)**:
  ```json
  {
    "items": [
      {
        "id": 1,
        "name": "deep-learning-lab",
        "description": "Student project for DL",
        "owner": "student1",
        "status": "running",
        "created_at": "2024-01-01T10:00:00Z",
        "updated_at": "2024-01-02T10:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
  ```

### Get Project Details
Get detailed information about a specific project, including resource usage and pods.

- **URL**: `/projects/{id}`
- **Method**: `GET`
- **Path Params**:
  - `id` (int): Project ID.

- **Success Response (200 OK)**:
  ```json
  {
    "id": 1,
    "name": "deep-learning-lab",
    "owner": "student1",
    "status": "running",
    "resources": {
      "cpu_usage": "0.5",
      "memory_usage": "512Mi",
      "pods": [
        {
          "name": "deep-learning-lab-deployment-xyz",
          "status": "Running",
          "restarts": 0
        }
      ]
    }
  }
  ```

## 2. Registry Management

### List Registries
Get all configured container registries.

- **URL**: `/registries`
- **Method**: `GET`

- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "name": "Harbor Local",
      "url": "https://harbor.example.com",
      "username": "admin",
      "is_active": true
    }
  ]
  ```

### Create Registry
Add a new container registry configuration.

- **URL**: `/registries`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "Harbor Local",
    "url": "https://harbor.example.com",
    "username": "admin",
    "password": "secretparams"
  }
  ```

### Delete Registry
- **URL**: `/registries/{id}`
- **Method**: `DELETE`

### Sync Registry
Manually trigger a synchronization to fetch images/charts from the registry.

- **URL**: `/registries/{id}/sync`
- **Method**: `POST`
- **Success Response (202 Accepted)**:
  ```json
  {
    "message": "Sync started",
    "task_id": "uuid-1234"
  }
  ```

## 3. Resource Monitoring

### Cluster Overview
Get high-level cluster metrics.

- **URL**: `/monitoring/overview`
- **Method**: `GET`

- **Success Response (200 OK)**:
  ```json
  {
    "cpu": {
      "total": 16,
      "used": 4.5,
      "percentage": 28.1
    },
    "memory": {
      "total": "32Gi",
      "used": "12Gi",
      "percentage": 37.5
    },
    "node_count": 3,
    "pod_count": 45
  }
  ```

### Namespace Usage
Get resource usage per namespace (useful for identifying heavy users).

- **URL**: `/monitoring/namespaces`
- **Method**: `GET`

- **Success Response (200 OK)**:
  ```json
  [
    {
      "namespace": "student-1",
      "cpu_usage": "0.5",
      "memory_usage": "1Gi",
      "active_pods": 2
    }
  ]
  ```

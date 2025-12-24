export interface User {
  username: string
  role: 'teacher' | 'student'
}

export interface Project {
  id: string
  name: string
  studentId: string
  status: 'running' | 'stopped' | 'error'
  url?: string
}

export interface Deployment {
  name: string
  namespace: string
  replicas: number
  availableReplicas: number
  status: string
}

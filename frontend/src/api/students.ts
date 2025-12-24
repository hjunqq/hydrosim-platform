import request from './request'

export interface Student {
    id: number
    student_code: string
    name: string
    project_type: 'gd' | 'cd'
    git_repo_url?: string
    domain?: string
    created_at: string
}

export interface Teacher {
    id: number
    username: string
    email?: string
    is_active: boolean
}

export interface CreateStudentParams {
    student_code: string
    name: string
    project_type: 'gd' | 'cd'
    git_repo_url?: string
}

export interface DeployParams {
    image_tag: string
}

export const studentsApi = {
    list(params?: { project_type?: string }) {
        return request.get<Student[]>('/api/v1/students', { params })
    },

    get(id: number) {
        return request.get<Student>(`/api/v1/students/${id}`)
    },

    create(data: CreateStudentParams) {
        return request.post<Student>('/api/v1/students', data)
    },

    update(id: number, data: Partial<CreateStudentParams>) {
        return request.put<Student>(`/api/v1/students/${id}`, data)
    },

    delete(id: number) {
        return request.delete(`/api/v1/students/${id}`)
    },

    deploy(studentId: number, data: DeployParams) {
        return request.post<{ status: string, domain: string }>(`/api/v1/deploy/${studentId}`, data)
    }
}

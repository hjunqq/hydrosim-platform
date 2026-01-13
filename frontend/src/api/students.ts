import request from './request'

export interface Student {
    id: number
    student_code: string
    name: string
    project_type: 'gd' | 'cd'
    git_repo_url?: string
    expected_image_name?: string
    domain?: string
    is_active?: boolean
    created_at: string
    latest_deploy_status?: string
    latest_deploy_message?: string
    running_image?: string
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
    expected_image_name?: string
}

export interface ResetPasswordResult {
    message: string
    new_password: string
    student_code: string
    student_name: string
}

export interface ImportError {
    row: number
    student_code?: string
    field?: string
    error: string
}

export interface ImportResult {
    total: number
    success: number
    failed: number
    created_students: { id: number; student_code: string; name: string }[]
    errors: ImportError[]
}

export const studentsApi = {
    list(params?: { project_type?: string }) {
        return request.get<Student[]>('/api/v1/students/', { params })
    },

    get(id: number) {
        return request.get<Student>(`/api/v1/students/${id}/`)
    },

    create(data: CreateStudentParams) {
        return request.post<Student>('/api/v1/students/', data)
    },

    update(id: number, data: Partial<CreateStudentParams>) {
        return request.put<Student>(`/api/v1/students/${id}/`, data)
    },

    delete(id: number) {
        return request.delete(`/api/v1/students/${id}/`)
    },

    // 账号管理 API
    async resetPassword(id: number): Promise<ResetPasswordResult> {
        // 注意：request 拦截器已经返回 response.data，所以这里直接返回
        const result = await request.post<ResetPasswordResult>(`/api/v1/students/${id}/reset-password/`)
        return result as unknown as ResetPasswordResult
    },

    async toggleStatus(id: number, isActive: boolean) {
        // 注意：request 拦截器已经返回 response.data
        const result = await request.patch<{ message: string; student_code: string; is_active: boolean }>(
            `/api/v1/students/${id}/status/`,
            null,
            { params: { is_active: isActive } }
        )
        return result as unknown as { message: string; student_code: string; is_active: boolean }
    },

    // 批量操作 API
    async importStudents(file: File): Promise<ImportResult> {
        const formData = new FormData()
        formData.append('file', file)
        // 注意：request 拦截器已经返回 response.data
        const result = await request.post<ImportResult>('/api/v1/admin/batch/students/import/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return result as unknown as ImportResult
    },

    exportStudents(format: 'csv' = 'csv', projectType?: string) {
        const params: Record<string, string> = { format }
        if (projectType) params.project_type = projectType
        return request.get('/api/v1/admin/batch/students/export/', {
            params,
            responseType: 'blob'
        })
    },

    downloadTemplate() {
        return request.get('/api/v1/admin/batch/students/template/', {
            responseType: 'blob'
        })
    }
}


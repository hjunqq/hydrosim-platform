import request from './request'
import { Student } from './students'

export interface AdminProject extends Student {
    teacher_id?: number
    latest_deploy_status?: string
    latest_deploy_time?: string
    latest_deploy_message?: string
    latest_deploy_id?: number
    running_image?: string
}

export const adminProjectsApi = {
    async list(params?: { page?: number, limit?: number, search?: string }) {
        const res = await request.get<AdminProject[]>('/api/v1/admin/projects/', { params });
        return res as unknown as AdminProject[];
    },

    async get(id: number) {
        const res = await request.get<AdminProject>(`/api/v1/admin/projects/${id}/`);
        return res as any as AdminProject;
    },

    async update(id: number, data: Partial<AdminProject>) {
        const res = await request.put<AdminProject>(`/api/v1/admin/projects/${id}/`, data);
        return res as unknown as AdminProject;
    }
}

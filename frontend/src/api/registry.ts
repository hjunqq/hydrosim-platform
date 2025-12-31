import request from './request'

export interface Registry {
    id: number
    name: string
    url: string
    username?: string
    is_active: boolean
    created_at: string
}

export interface CreateRegistryParams {
    name: string
    url: string
    username?: string
    password?: string
    is_active?: boolean
}

export interface UpdateRegistryParams {
    name?: string
    url?: string
    username?: string
    password?: string
    is_active?: boolean
}

export const registryApi = {
    async list() {
        const res = await request.get<Registry[]>('/api/v1/admin/registries/');
        return res as unknown as Registry[];
    },

    async create(data: CreateRegistryParams) {
        const res = await request.post<Registry>('/api/v1/admin/registries/', data);
        return res as unknown as Registry;
    },

    async update(id: number, data: UpdateRegistryParams) {
        const res = await request.put<Registry>(`/api/v1/admin/registries/${id}/`, data);
        return res as unknown as Registry;
    },

    async delete(id: number) {
        const res = await request.delete(`/api/v1/admin/registries/${id}/`);
        return res as unknown as Registry;
    },

    async getCatalog(id: number) {
        const res = await request.get<string[]>(`/api/v1/admin/registries/${id}/catalog/`);
        return res as unknown as string[];
    },

    async getTags(id: number, repository: string) {
        const res = await request.get<string[]>(`/api/v1/admin/registries/${id}/tags/`, {
            params: { repository }
        });
        return res as unknown as string[];
    },

    async deleteTag(id: number, repository: string, tag: string) {
        const res = await request.delete<boolean>(`/api/v1/admin/registries/${id}/tags/`, {
            params: { repository, tag }
        });
        return res as unknown as boolean;
    }
}

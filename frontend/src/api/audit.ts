import request from './request'

export interface AuditLog {
    id: number
    action: string
    resource_type: string
    resource_id?: number
    resource_name?: string
    user_id?: number
    username?: string
    user_role?: string
    message?: string
    ip_address?: string
    created_at: string
}

export interface AuditLogListResponse {
    items: AuditLog[]
    total: number
    page: number
    page_size: number
}

export interface AuditStats {
    total_logs: number
    action_counts: Record<string, number>
    resource_type_counts: Record<string, number>
    recent_activity: AuditLog[]
}

export interface AuditLogFilters {
    action?: string
    resource_type?: string
    user_id?: number
    start_date?: string
    end_date?: string
    page?: number
    page_size?: number
}

export const auditApi = {
    async list(filters: AuditLogFilters = {}): Promise<AuditLogListResponse> {
        const params = new URLSearchParams()
        if (filters.action) params.append('action', filters.action)
        if (filters.resource_type) params.append('resource_type', filters.resource_type)
        if (filters.user_id) params.append('user_id', String(filters.user_id))
        if (filters.start_date) params.append('start_date', filters.start_date)
        if (filters.end_date) params.append('end_date', filters.end_date)
        params.append('page', String(filters.page || 1))
        params.append('page_size', String(filters.page_size || 20))

        const result = await request.get<AuditLogListResponse>(
            `/api/v1/admin/audit/?${params.toString()}`
        )
        return result as unknown as AuditLogListResponse
    },

    async getStats(days: number = 7): Promise<AuditStats> {
        const result = await request.get<AuditStats>(
            `/api/v1/admin/audit/stats/?days=${days}`
        )
        return result as unknown as AuditStats
    },

    async getActionTypes(): Promise<string[]> {
        const result = await request.get<string[]>('/api/v1/admin/audit/actions/')
        return result as unknown as string[]
    },

    async getResourceTypes(): Promise<string[]> {
        const result = await request.get<string[]>('/api/v1/admin/audit/resource-types/')
        return result as unknown as string[]
    }
}

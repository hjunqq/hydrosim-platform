import request from './request'

export interface ClusterOverview {
    nodes: number
    pods: number
    cpu_percentage?: number
    memory_percentage?: number
    status?: string
}

export interface NamespaceUsage {
    namespace: string
    active_pods: number
    cpu?: string
    memory?: string
}

export const monitoringApi = {
    async getOverview() {
        const res = await request.get<ClusterOverview>('/api/v1/admin/monitoring/overview');
        return res as unknown as ClusterOverview;
    },

    async getNamespaceUsage() {
        const res = await request.get<NamespaceUsage[]>('/api/v1/admin/monitoring/namespaces');
        return res as unknown as NamespaceUsage[];
    }
}

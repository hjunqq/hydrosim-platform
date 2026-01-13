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

export interface PodStatusDistribution {
    Running: number
    Pending: number
    Succeeded: number
    Failed: number
    Unknown: number
}

export interface ClusterEvent {
    type: string
    reason: string
    message: string
    namespace: string
    name: string
    kind: string
    count: number
    first_timestamp?: string
    last_timestamp?: string
}

export const monitoringApi = {
    async getOverview() {
        const res = await request.get<ClusterOverview>('/api/v1/admin/monitoring/overview');
        return res as unknown as ClusterOverview;
    },

    async getNamespaceUsage() {
        const res = await request.get<NamespaceUsage[]>('/api/v1/admin/monitoring/namespaces');
        return res as unknown as NamespaceUsage[];
    },

    async getPodStatusDistribution() {
        const res = await request.get<PodStatusDistribution>('/api/v1/admin/monitoring/pod-status');
        return res as unknown as PodStatusDistribution;
    },

    async getRecentEvents(limit: number = 20) {
        const res = await request.get<ClusterEvent[]>(`/api/v1/admin/monitoring/events?limit=${limit}`);
        return res as unknown as ClusterEvent[];
    }
}

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // 数据被认为是新鲜的时间（5分钟）
            staleTime: 5 * 60 * 1000,
            // 缓存时间（30分钟）
            gcTime: 30 * 60 * 1000,
            // 窗口重新获得焦点时刷新数据
            refetchOnWindowFocus: false,
            // 网络重连时刷新
            refetchOnReconnect: true,
            // 失败重试次数
            retry: 1,
            // 重试延迟
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
        mutations: {
            retry: 0,
        },
    },
})

// Query Keys - 用于统一管理缓存键
export const queryKeys = {
    // Students
    students: {
        all: ['students'] as const,
        list: (filters?: any) => [...queryKeys.students.all, 'list', filters] as const,
        detail: (id: number) => [...queryKeys.students.all, 'detail', id] as const,
    },
    // Projects
    projects: {
        all: ['projects'] as const,
        list: (filters?: any) => [...queryKeys.projects.all, 'list', filters] as const,
        detail: (id: number) => [...queryKeys.projects.all, 'detail', id] as const,
        me: () => [...queryKeys.projects.all, 'me'] as const,
    },
    // Deployments
    deployments: {
        all: ['deployments'] as const,
        list: (filters?: any) => [...queryKeys.deployments.all, 'list', filters] as const,
        byStudent: (studentId: number) => [...queryKeys.deployments.all, 'student', studentId] as const,
    },
    // Monitoring
    monitoring: {
        all: ['monitoring'] as const,
        overview: () => [...queryKeys.monitoring.all, 'overview'] as const,
        namespaces: () => [...queryKeys.monitoring.all, 'namespaces'] as const,
        podStatus: () => [...queryKeys.monitoring.all, 'pod-status'] as const,
        events: (limit?: number) => [...queryKeys.monitoring.all, 'events', limit] as const,
    },
    // Audit
    audit: {
        all: ['audit'] as const,
        list: (filters?: any) => [...queryKeys.audit.all, 'list', filters] as const,
        stats: (days?: number) => [...queryKeys.audit.all, 'stats', days] as const,
    },
    // Auth
    auth: {
        profile: ['auth', 'profile'] as const,
    },
}

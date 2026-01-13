/**
 * React Query hooks for data fetching
 * 使用这些 hooks 可以获得自动缓存、重新获取、loading 状态等功能
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../config/queryClient'
import { monitoringApi, ClusterOverview, NamespaceUsage, PodStatusDistribution } from '../api/monitoring'
import { auditApi, AuditLog, AuditLogFilters, AuditStats } from '../api/audit'
import { studentsApi } from '../api/students'

// ==================== Monitoring Hooks ====================

export function useClusterOverview() {
    return useQuery({
        queryKey: queryKeys.monitoring.overview(),
        queryFn: () => monitoringApi.getOverview(),
        staleTime: 30 * 1000, // 30秒内数据新鲜
        refetchInterval: 60 * 1000, // 每分钟自动刷新
    })
}

export function useNamespaceUsage() {
    return useQuery({
        queryKey: queryKeys.monitoring.namespaces(),
        queryFn: () => monitoringApi.getNamespaceUsage(),
        staleTime: 30 * 1000,
    })
}

export function usePodStatusDistribution() {
    return useQuery({
        queryKey: queryKeys.monitoring.podStatus(),
        queryFn: () => monitoringApi.getPodStatusDistribution(),
        staleTime: 30 * 1000,
    })
}

export function useClusterEvents(limit: number = 20) {
    return useQuery({
        queryKey: queryKeys.monitoring.events(limit),
        queryFn: () => monitoringApi.getRecentEvents(limit),
        staleTime: 30 * 1000,
    })
}

// ==================== Audit Hooks ====================

export function useAuditLogs(filters: AuditLogFilters = {}) {
    return useQuery({
        queryKey: queryKeys.audit.list(filters),
        queryFn: () => auditApi.list(filters),
        staleTime: 60 * 1000,
    })
}

export function useAuditStats(days: number = 7) {
    return useQuery({
        queryKey: queryKeys.audit.stats(days),
        queryFn: () => auditApi.getStats(days),
        staleTime: 5 * 60 * 1000,
    })
}

// ==================== Students Hooks ====================

export function useStudents() {
    return useQuery({
        queryKey: queryKeys.students.all,
        queryFn: () => studentsApi.list(),
        staleTime: 60 * 1000,
    })
}

export function useStudent(id: number) {
    return useQuery({
        queryKey: queryKeys.students.detail(id),
        queryFn: () => studentsApi.get(id),
        enabled: !!id,
    })
}

// ==================== Invalidation Helpers ====================

export function useInvalidateMonitoring() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.all })
    }
}

export function useInvalidateAudit() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.all })
    }
}

export function useInvalidateStudents() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    }
}

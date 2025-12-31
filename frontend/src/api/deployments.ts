import request from './request'

export interface DeployRequest {
    image: string
    project_type: 'gd' | 'cd'
}

export interface DeployResponse {
    status: string
    message: string
    url?: string
}

export interface DeploymentStatus {
    status: 'not_deployed' | 'deploying' | 'running' | 'error' | 'stopped'
    detail: string
    ready_replicas: string
}

export interface DeploymentRecord {
    id: number
    student_id: number
    image_tag: string
    status: string
    last_deploy_time?: string
    created_at: string
    message?: string
}

export const deploymentsApi = {
    list(params?: { student_id?: number; skip?: number; limit?: number }) {
        return request.get<DeploymentRecord[]>('/api/v1/deployments/', { params })
    },
    /**
     * Trigger a new deployment or update an existing one.
     */
    triggerDeploy(studentCode: string, data: DeployRequest) {
        return request.post<DeployResponse>(`/api/v1/deploy/${studentCode}/`, data)
    },

    /**
     * Get the realtime status of a deployment.
     */
    getStatus(studentCode: string, projectType: string) {
        return request.get<DeploymentStatus>(`/api/v1/deploy/${studentCode}/`, {
            params: { project_type: projectType }
        })
    }
}

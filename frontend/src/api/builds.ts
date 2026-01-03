import request from './request';

export interface Build {
    id: number;
    student_id: number;
    commit_sha: string;
    branch: string;
    image_tag: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'error' | 'cancelled';
    message: string;
    duration?: number;
    created_at: string;
    finished_at?: string;
}

export const buildsApi = {
    getBuilds: (params: { student_id?: number; skip?: number; limit?: number }) =>
        request.get<Build[]>('/builds/', { params }),

    triggerBuild: (student_id: number, branch?: string) =>
        request.post<Build>('/builds/trigger', null, { params: { student_id, branch } }),

    getBuildLogs: (build_id: number) =>
        request.get<{ content: string }>(`/builds/${build_id}/logs`),
};

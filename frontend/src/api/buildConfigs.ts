import request from './request';

export interface BuildConfig {
    student_id: number;
    repo_url: string;
    branch: string;
    dockerfile_path: string;
    context_path: string;
    image_repo?: string;
    tag_strategy?: string;
    auto_build: boolean;
    auto_deploy: boolean;
    deploy_key_public?: string;
    deploy_key_fingerprint?: string;
    deploy_key_created_at?: string;
}

export const buildConfigsApi = {
    getMyConfig: () =>
        request.get<BuildConfig>('/api/v1/build-configs/me'),

    getConfig: (student_id: number) =>
        request.get<BuildConfig>(`/api/v1/build-configs/${student_id}`),

    updateConfig: (student_id: number, data: Partial<BuildConfig>) =>
        request.put<BuildConfig>(`/api/v1/build-configs/${student_id}`, data),
    generateDeployKey: (student_id: number, force = false, attachToGitea = true) =>
        request.post<BuildConfig>(
            `/api/v1/build-configs/${student_id}/deploy-key`,
            { force, attach_to_gitea: attachToGitea }
        ),
};

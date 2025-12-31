import request from './request';
import { AdminProject } from './adminProjects';

export interface ProjectOut extends AdminProject { }

export const projectsApi = {
    list: (student_id?: string) => request.get<ProjectOut[]>('/api/v1/projects/', { params: { student_id } }) as any as Promise<ProjectOut[]>,
    getMe: () => request.get<ProjectOut>('/api/v1/projects/me/') as any as Promise<ProjectOut>,
    get: (id: number) => request.get<ProjectOut>(`/api/v1/projects/${id}/`) as any as Promise<ProjectOut>,
};

import request from './request';

export interface SystemSetting {
    id: number;
    platform_name: string;
    portal_title: string;
    env_type: string;
    domain_name?: string;
    student_domain_prefix?: string;
    student_domain_base?: string;
    contact_email?: string;
    help_url?: string;
    footer_text?: string;
}

export interface Semester {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export const settingsApi = {
    getSettings: () => request.get<SystemSetting>('/api/v1/admin/settings/'),
    updateSettings: (data: Partial<SystemSetting>) => request.put<SystemSetting>('/api/v1/admin/settings/', data),

    getSemesters: () => request.get<Semester[]>('/api/v1/admin/semesters/'),
    createSemester: (data: Omit<Semester, 'id'>) => request.post<Semester>('/api/v1/admin/semesters/', data),
    updateSemester: (id: number, data: Partial<Semester>) => request.put<Semester>(`/api/v1/admin/semesters/${id}/`, data),
    deleteSemester: (id: number) => request.delete<boolean>(`/api/v1/admin/semesters/${id}/`)
};

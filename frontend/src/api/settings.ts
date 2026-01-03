import request from './request';

export interface SystemSetting {
    id: number;
    platform_name?: string;
    portal_title?: string;
    env_type?: string;
    domain_name?: string;
    student_domain_prefix?: string;
    student_domain_base?: string;
    contact_email?: string;
    help_url?: string;
    footer_text?: string;
    build_namespace?: string;
    default_registry_id?: number;
    default_image_repo_template?: string;
    timezone?: string;
}

export interface Semester {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export const settingsApi = {
    getSettings: async (): Promise<SystemSetting> => {
        const response = await request.get('/admin/settings/');
        return response.data;
    },
    updateSettings: async (data: Partial<SystemSetting>): Promise<SystemSetting> => {
        const response = await request.put('/admin/settings/', data);
        return response.data;
    },
    getSemesters: async (): Promise<Semester[]> => {
        const response = await request.get('/admin/semesters/');
        return response.data;
    }
};

import request from './request';

export interface UserProfile {
    id: number;
    username: string;
    email?: string;
    full_name?: string;
    department?: string;
    phone?: string;
    role: string;
    created_at: string;
}

export interface ProfileUpdateParams {
    email?: string;
    full_name?: string;
    department?: string;
    phone?: string;
}

export interface PasswordUpdateParams {
    current_password: str;
    new_password: str;
}

export const profileApi = {
    getMe: () => request.get<UserProfile>('/api/v1/profile/me'),
    updateMe: (data: ProfileUpdateParams) => request.put<UserProfile>('/api/v1/profile/me', data),
    updatePassword: (data: PasswordUpdateParams) => request.put<boolean>('/api/v1/profile/me/password', data)
};

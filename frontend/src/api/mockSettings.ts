export interface SystemSettings {
    platformName: string;
    portalTitle: string;
    logoUrl?: string;
    envType: 'production' | 'test' | 'demo';
    domainName: string;
    timezone: string;
    contactEmail: string;
    helpUrl: string;
}

export interface Semester {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'active' | 'archived';
}

export interface UserProfile {
    name: string;
    idNumber: string;
    department: string;
    email: string;
    phone?: string;
    role: string;
    lastLogin: string;
}

export const mockSettings: SystemSettings = {
    platformName: '毕业设计项目管理平台',
    portalTitle: 'Hydrosim Portal',
    envType: 'demo',
    domainName: 'portal.hydrosim.cn',
    timezone: 'Asia/Shanghai',
    contactEmail: 'admin@hydrosim.cn',
    helpUrl: 'https://docs.hydrosim.cn'
};

export const mockSemesters: Semester[] = [
    { id: '1', name: '2023-2024 秋季学期', startDate: '2023-09-01', endDate: '2024-01-15', status: 'archived' },
    { id: '2', name: '2023-2024 春季学期', startDate: '2024-02-25', endDate: '2024-07-10', status: 'active' }
];

export const mockUserProfile: UserProfile = {
    name: '张三',
    idNumber: '2024001',
    department: '计算机科学与技术学院',
    email: 'zhangsan@university.edu.cn',
    phone: '13800138000',
    role: '管理员',
    lastLogin: '2025-12-30 23:45'
};

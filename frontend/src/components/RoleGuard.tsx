import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type UserRole = 'admin' | 'teacher' | 'student';

interface RoleGuardProps {
    allowedRoles: UserRole[];
    children: React.ReactNode;
    fallbackPath?: string;
}

/**
 * 角色权限守卫组件
 * 用于保护需要特定角色才能访问的路由
 * 
 * @example
 * <RoleGuard allowedRoles={['admin']}>
 *   <AdminProjectsPage />
 * </RoleGuard>
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
    allowedRoles,
    children,
    fallbackPath = '/dashboard'
}) => {
    const { user, isLoading } = useAuth();

    // 加载中显示占位
    if (isLoading) {
        return (
            <div className="role-guard-loading" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-3)'
            }}>
                加载中...
            </div>
        );
    }

    // 检查用户角色
    const userRole = user?.role as UserRole | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
};

/**
 * 仅管理员可访问
 */
export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <RoleGuard allowedRoles={['admin']}>{children}</RoleGuard>
);

/**
 * 管理员或教师可访问
 */
export const TeacherOrAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <RoleGuard allowedRoles={['admin', 'teacher']}>{children}</RoleGuard>
);

/**
 * 仅学生可访问
 */
export const StudentOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <RoleGuard allowedRoles={['student']}>{children}</RoleGuard>
);

export default RoleGuard;

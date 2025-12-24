import React from 'react';

export type StatusType = 'running' | 'success' | 'processing' | 'error' | 'failed' | 'pending' | 'warning';

interface StatusBadgeProps {
    status: StatusType | string;
    text?: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    running: { color: 'var(--success-6)', bg: 'var(--success-1)', label: '运行中' },
    success: { color: 'var(--success-6)', bg: 'var(--success-1)', label: '成功' },
    processing: { color: 'var(--primary-6)', bg: 'var(--primary-1)', label: '处理中' },
    error: { color: 'var(--danger-6)', bg: 'var(--danger-1)', label: '错误' },
    failed: { color: 'var(--danger-6)', bg: 'var(--danger-1)', label: '失败' },
    pending: { color: 'var(--text-3)', bg: 'var(--fill-2)', label: '待处理' },
    warning: { color: 'var(--warning-6)', bg: 'var(--warning-1)', label: '警告' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
    const normalizedStatus = (status || 'pending').toLowerCase();
    const config = statusConfig[normalizedStatus] || statusConfig['pending'];
    const displayLabel = text || config.label;

    return (
        <span
            className="status-badge"
            style={{
                backgroundColor: config.bg,
                color: config.color,
            }}
        >
            <span className="dot"></span>
            {displayLabel}
        </span>
    );
};

export default StatusBadge;

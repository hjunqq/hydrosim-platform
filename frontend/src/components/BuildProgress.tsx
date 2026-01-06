import React, { useEffect, useState } from 'react';
import Button from 'devextreme-react/button';
import { buildsApi, Build } from '../api/builds';

interface BuildProgressProps {
    studentId: number;
    buildId?: number | null;
}

const BuildProgress: React.FC<BuildProgressProps> = ({ studentId, buildId }) => {
    const [build, setBuild] = useState<Build | null>(null);
    const [loading, setLoading] = useState(false);

    const loadBuild = async () => {
        if (!studentId) return;
        try {
            setLoading(true);
            const data = await buildsApi.getBuilds({ student_id: studentId, limit: 10 });
            let selected = buildId ? data.find(item => item.id === buildId) : null;
            if (!selected && data.length > 0) selected = data[0];
            setBuild(selected || null);
        } catch (err) {
            console.error('Failed to load build progress', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!studentId) return;
        loadBuild();
        const interval = setInterval(loadBuild, 3000);
        return () => clearInterval(interval);
    }, [studentId, buildId]);

    const getStatusDisplay = (status?: Build['status']) => {
        switch (status) {
            case 'success':
                return { text: '构建成功', className: 'st-success', color: '#52c41a' };
            case 'running':
                return { text: '构建中', className: 'st-waiting', color: '#1890ff' };
            case 'failed':
            case 'error':
                return { text: '构建失败', className: 'st-danger', color: '#ff4d4f' };
            case 'pending':
                return { text: '等待中', className: 'st-waiting', color: '#1890ff' };
            default:
                return { text: '未知', className: 'st-default', color: '#d9d9d9' };
        }
    };

    const renderRow = (label: string, value?: string | number | null) => (
        <>
            <div style={{ color: 'var(--text-3)' }}>{label}</div>
            <div style={{ color: 'var(--text-1)', wordBreak: 'break-all' }}>{value || '-'}</div>
        </>
    );

    if (!studentId) {
        return <div style={{ padding: 20, color: 'var(--text-3)' }}>请选择项目</div>;
    }

    return (
        <div style={{ padding: 20 }}>
            {loading && !build ? (
                <div style={{ color: 'var(--text-3)' }}>加载中...</div>
            ) : null}
            {!build ? (
                <div style={{ color: 'var(--text-3)' }}>暂无构建记录</div>
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <span className={`status-badge ${getStatusDisplay(build.status).className}`}>
                            <span className="dot" style={{ background: getStatusDisplay(build.status).color }}></span>
                            {getStatusDisplay(build.status).text}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Build #{build.id}</span>
                        <Button icon="refresh" stylingMode="text" onClick={loadBuild} />
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr',
                        rowGap: 10,
                        columnGap: 12,
                        fontSize: 13
                    }}>
                        {renderRow('分支', build.branch)}
                        {renderRow('Commit', build.commit_sha ? build.commit_sha.substring(0, 7) : null)}
                        {renderRow('镜像 Tag', build.image_tag)}
                        {renderRow('开始时间', build.created_at ? new Date(build.created_at).toLocaleString('zh-CN') : null)}
                        {renderRow('完成时间', build.finished_at ? new Date(build.finished_at).toLocaleString('zh-CN') : null)}
                        {renderRow('耗时(s)', build.duration ?? null)}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                        {build.message || '无额外信息'}
                    </div>
                </>
            )}
        </div>
    );
};

export default BuildProgress;

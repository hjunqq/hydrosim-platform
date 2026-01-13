import React, { useEffect, useState, useRef } from 'react';
import Button from 'devextreme-react/button';
import { ScrollView } from 'devextreme-react/scroll-view';
import { buildsApi, Build } from '../api/builds';

interface BuildProgressProps {
    studentId: number;
    buildId?: number | null;
}

const BuildProgress: React.FC<BuildProgressProps> = ({ studentId, buildId }) => {
    const [build, setBuild] = useState<Build | null>(null);
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<any>(null);
    const lastLogLengthRef = useRef<number>(0);

    const loadBuild = async () => {
        if (!studentId) return;
        try {
            setLoading(true);
            const data = await buildsApi.getBuilds({ student_id: studentId, limit: 50 }) as unknown as Build[];
            let selected: Build | null = null;

            if (buildId) {
                // If specific buildId provided, find it in the list
                selected = data.find(item => item.id === buildId) || null;
                // If not found in the first 50, but we have a buildId, we should ideally fetch it specifically,
                // but for now, we just don't fallback to the latest one.
            } else if (data.length > 0) {
                // If no buildId provided, use the latest one
                selected = data[0];
            }

            setBuild(selected);

            if (selected) {
                await loadLogs(selected.id);
            }
        } catch (err) {
            console.error('Failed to load build progress', err);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async (id: number) => {
        try {
            const logData = await buildsApi.getBuildLogs(id) as unknown as { content: string };
            const newLogs = logData.content || 'No logs available.';
            setLogs(newLogs);

            // Auto scroll to bottom if new logs added
            if (newLogs.length > lastLogLengthRef.current) {
                setTimeout(() => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.instance().scrollTo(scrollViewRef.current.instance().scrollHeight());
                    }
                }, 100);
            }
            lastLogLengthRef.current = newLogs.length;
        } catch (err) {
            console.error('Failed to load logs', err);
        }
    };

    useEffect(() => {
        if (!studentId) return;
        loadBuild();

        // Polling interval: 3s if running, otherwise stop polling
        const interval = setInterval(async () => {
            if (build && (build.status === 'running' || build.status === 'pending')) {
                await loadBuild();
            } else if (!build) {
                await loadBuild();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [studentId, buildId, build?.status]);

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
        <React.Fragment key={label}>
            <div style={{ color: 'var(--text-3)' }}>{label}</div>
            <div style={{ color: 'var(--text-1)', wordBreak: 'break-all' }}>{value || '-'}</div>
        </React.Fragment>
    );

    if (!studentId) {
        return <div style={{ padding: 20, color: 'var(--text-3)' }}>请选择项目</div>;
    }

    return (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {loading && !build ? (
                <div style={{ color: 'var(--text-3)', padding: 20 }}>加载中...</div>
            ) : null}
            {!build ? (
                <div style={{ color: 'var(--text-3)', padding: 20 }}>暂无构建记录</div>
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                        <span className={`status-badge ${getStatusDisplay(build.status).className}`}>
                            <span className="dot" style={{ background: getStatusDisplay(build.status).color }}></span>
                            {getStatusDisplay(build.status).text}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Build #{build.id}</span>
                        <Button icon="refresh" stylingMode="text" onClick={loadBuild} />
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr 100px 1fr',
                        rowGap: 8,
                        columnGap: 12,
                        fontSize: 12,
                        marginBottom: 16,
                        padding: 12,
                        background: 'var(--fill-0)',
                        borderRadius: 8
                    }}>
                        {renderRow('分支', build.branch)}
                        {renderRow('开始时间', build.created_at ? new Date(build.created_at).toLocaleString('zh-CN') : null)}
                        {renderRow('镜像 Tag', build.image_tag)}
                        {renderRow('耗时(s)', build.duration ?? null)}
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-2)' }}>构建日志</div>
                        <ScrollView
                            ref={scrollViewRef}
                            height={300}
                            style={{
                                background: '#1e1e1e',
                                borderRadius: 6,
                                border: '1px solid #333'
                            }}
                        >
                            <pre style={{
                                margin: 0,
                                padding: '12px 16px',
                                color: '#d4d4d4',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                fontSize: 12,
                                lineHeight: '1.6'
                            }}>
                                {logs}
                            </pre>
                        </ScrollView>
                    </div>

                    {build.message && (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', padding: '8px 12px', background: 'var(--fill-1)', borderRadius: 4 }}>
                            <i className="dx-icon-info" style={{ marginRight: 6, fontSize: 14 }}></i>
                            {build.message}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BuildProgress;

import React, { useEffect, useState, useRef } from 'react';
import { Popup } from 'devextreme-react/popup';
import Button from 'devextreme-react/button';
import { buildsApi, Build } from '../api/builds';

interface BuildStatusModalProps {
    visible: boolean;
    onClose: () => void;
    onHidden?: () => void;
    studentName?: string;
    studentId?: number;
    buildId?: number | null;
}

type StepStatus = 'pending' | 'processing' | 'success' | 'failed';

interface Step {
    id: number;
    label: string;
    labelZh: string;
    status: StepStatus;
}

const BuildStatusModal: React.FC<BuildStatusModalProps> = ({ visible, onClose, onHidden, studentName, studentId, buildId: initialBuildId }) => {
    const [steps, setSteps] = useState<Step[]>([
        { id: 1, label: 'Queueing', labelZh: '排队中', status: 'pending' },
        { id: 2, label: 'Building', labelZh: '正在构建', status: 'pending' },
        { id: 3, label: 'Finalizing', labelZh: '正在完成', status: 'pending' },
    ]);
    const [logs, setLogs] = useState<string>('');
    const [build, setBuild] = useState<Build | null>(null);
    const [currentBuildId, setCurrentBuildId] = useState<number | null>(initialBuildId || null);

    const logEndRef = useRef<HTMLDivElement>(null);

    // Initial load or track latest
    useEffect(() => {
        if (!visible) {
            setBuild(null);
            setLogs('');
            setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
            return;
        }

        if (initialBuildId) {
            setCurrentBuildId(initialBuildId);
        } else if (studentId) {
            loadLatestBuild();
        }
    }, [visible, initialBuildId, studentId]);

    const loadLatestBuild = async () => {
        if (!studentId) return;
        try {
            const data = await buildsApi.getBuilds({ student_id: studentId, limit: 1 }) as unknown as Build[];
            if (data.length > 0) {
                setCurrentBuildId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load latest build', err);
        }
    };

    // Polling logic
    useEffect(() => {
        if (!visible || !currentBuildId) return;

        let timer: ReturnType<typeof setInterval>;

        const fetchData = async () => {
            try {
                const data = await buildsApi.getBuilds({ student_id: studentId, limit: 10 }) as unknown as Build[];
                const found = data.find(b => b.id === currentBuildId);
                if (found) {
                    setBuild(found);
                    updateSteps(found.status);

                    const logData = await buildsApi.getBuildLogs(currentBuildId) as unknown as { content: string };
                    setLogs(logData.content || '');

                    if (found.status === 'success' || found.status === 'failed' || found.status === 'error') {
                        clearInterval(timer);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch build status/logs', err);
            }
        };

        fetchData();
        timer = setInterval(fetchData, 3000);

        return () => clearInterval(timer);
    }, [visible, currentBuildId, studentId]);

    // Auto-scroll logs
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const updateSteps = (status: string) => {
        setSteps(prev => {
            const newSteps = prev.map(s => ({ ...s }));
            if (status === 'pending') {
                newSteps[0].status = 'processing';
            } else if (status === 'running') {
                newSteps[0].status = 'success';
                newSteps[1].status = 'processing';
            } else if (status === 'success') {
                newSteps[0].status = 'success';
                newSteps[1].status = 'success';
                newSteps[2].status = 'success';
            } else if (status === 'failed' || status === 'error') {
                const activeIdx = newSteps.findIndex(s => s.status === 'processing');
                if (activeIdx !== -1) {
                    newSteps[activeIdx].status = 'failed';
                } else if (newSteps[0].status === 'pending') {
                    newSteps[0].status = 'failed';
                } else if (newSteps[1].status === 'pending') {
                    newSteps[1].status = 'failed';
                }
            }
            return newSteps;
        });
    };

    const renderStep = (step: Step) => {
        let icon = <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#444' }} />;
        let color = '#888';

        if (step.status === 'processing') {
            icon = <i className="dx-icon-spincrement" style={{ fontSize: 16, color: 'var(--primary-6)', animation: 'spin 1s linear infinite' }} />;
            color = 'var(--primary-6)';
        } else if (step.status === 'success') {
            icon = <i className="dx-icon-check" style={{ fontSize: 16, color: 'var(--success-6)' }} />;
            color = 'var(--success-6)';
        } else if (step.status === 'failed') {
            icon = <i className="dx-icon-close" style={{ fontSize: 16, color: 'var(--danger-6)' }} />;
            color = 'var(--danger-6)';
        }

        return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 12, opacity: step.status === 'pending' ? 0.5 : 1 }}>
                <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>{icon}</div>
                <span style={{ marginLeft: 8, fontWeight: 500, color: '#D4D4D4', fontSize: 14 }}>{step.labelZh}</span>
                {step.status === 'processing' && <span style={{ marginLeft: 'auto', fontSize: 12, color }}>执行中...</span>}
            </div>
        );
    };

    const isComplete = build?.status === 'success' || build?.status === 'failed' || build?.status === 'error';

    return (
        <Popup
            title={`构建详情 - ${studentName || (currentBuildId ? '#' + currentBuildId : '')}`}
            visible={visible}
            onHiding={onClose}
            onHidden={onHidden}
            showTitle={true}
            dragEnabled={false}
            width={700}
            height={600}
            showCloseButton={false}
            shading={true}
            position="center"
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#121212', margin: '-16px', padding: '16px' }}>
                <div style={{ padding: '0 8px 16px', borderBottom: '1px solid #333', marginBottom: 16 }}>
                    {steps.map(step => renderStep(step))}
                </div>

                <div style={{
                    flex: 1,
                    backgroundColor: '#000',
                    borderRadius: 4,
                    padding: 12,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    fontSize: 13,
                    color: '#D4D4D4',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #333'
                }}>
                    <div style={{ paddingBottom: 8, borderBottom: '1px solid #222', marginBottom: 8, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                        <span>BUILD LOG OUTPUT</span>
                        {build && <span style={{ fontSize: 11 }}>ID: {build.id} | Branch: {build.branch || '-'}</span>}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#ccc' }}>
                            {logs || '等待日志输出...'}
                        </pre>
                        <div ref={logEndRef} />
                    </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                    {isComplete ? (
                        <>
                            {build?.status === 'success' ? (
                                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--success-6)', marginRight: 'auto' }}>
                                    <i className="dx-icon-check" style={{ marginRight: 4 }} /> 构建成功
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--danger-6)', marginRight: 'auto' }}>
                                    <i className="dx-icon-close" style={{ marginRight: 4 }} /> 构建失败
                                </span>
                            )}
                            <Button text="完成" type="default" onClick={onClose} stylingMode="contained" width={100} />
                        </>
                    ) : (
                        <>
                            <span style={{ fontSize: 12, color: '#666', marginRight: 'auto' }}>
                                自动刷新中 (3s)...
                            </span>
                            <Button text="后台运行" type="normal" onClick={onClose} stylingMode="outlined" />
                        </>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Popup>
    );
};

export default BuildStatusModal;

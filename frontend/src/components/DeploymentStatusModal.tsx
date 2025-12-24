import React, { useEffect, useState, useRef } from 'react';
import { Popup } from 'devextreme-react/popup';
import Button from 'devextreme-react/button';

interface DeploymentStatusModalProps {
    visible: boolean;
    onClose: () => void;
    studentName?: string;
    deploymentId?: number | string;
    domain?: string;
}

type StepStatus = 'pending' | 'processing' | 'success' | 'error';

interface Step {
    id: number;
    label: string;
    labelZh: string;
    status: StepStatus;
}

const DeploymentStatusModal: React.FC<DeploymentStatusModalProps> = ({ visible, onClose, studentName, domain }) => {
    const [steps, setSteps] = useState<Step[]>([
        { id: 1, label: 'Prepare Environment', labelZh: '准备环境', status: 'pending' },
        { id: 2, label: 'Pull Image', labelZh: '拉取镜像', status: 'pending' },
        { id: 3, label: 'Update Container', labelZh: '更新容器', status: 'pending' },
        { id: 4, label: 'Health Check', labelZh: '健康检查', status: 'pending' },
    ]);
    const [allLogs, setAllLogs] = useState<string[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Mock Simulation
    useEffect(() => {
        if (!visible) {
            setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
            setAllLogs(['> 初始化部署流程...']);
            return;
        }

        let stepIdx = 0;
        let logInterval: ReturnType<typeof setInterval>;

        const processStep = () => {
            if (stepIdx >= 4) return;

            setSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status: 'processing' } : s));

            const stepLabels = ['准备环境', '拉取镜像', '更新容器', '健康检查'];
            const mockLogs = [
                `[${new Date().toLocaleTimeString()}] 开始 ${stepLabels[stepIdx]}...`,
                `[${new Date().toLocaleTimeString()}] 执行命令中...`,
                `[${new Date().toLocaleTimeString()}] 验证输出...`,
                `[${new Date().toLocaleTimeString()}] ${stepLabels[stepIdx]} 完成 ✓`
            ];

            let logCount = 0;
            logInterval = setInterval(() => {
                if (logCount >= mockLogs.length) {
                    clearInterval(logInterval);
                    setSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status: 'success' } : s));
                    stepIdx++;
                    setTimeout(processStep, 500);
                    return;
                }
                setAllLogs(prev => [...prev, mockLogs[logCount]]);
                logCount++;
            }, 600);
        };

        processStep();

        return () => clearInterval(logInterval);
    }, [visible]);

    // Auto-scroll
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [allLogs]);

    const renderStep = (step: Step) => {
        let icon = <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />;
        let color = 'var(--text-3)';

        if (step.status === 'processing') {
            icon = <i className="dx-icon-spincrement" style={{ fontSize: 16, color: 'var(--primary-6)', animation: 'spin 1s linear infinite' }} />;
            color = 'var(--primary-6)';
        } else if (step.status === 'success') {
            icon = <i className="dx-icon-check" style={{ fontSize: 16, color: 'var(--success-6)' }} />;
            color = 'var(--success-6)';
        } else if (step.status === 'error') {
            icon = <i className="dx-icon-close" style={{ fontSize: 16, color: 'var(--danger-6)' }} />;
            color = 'var(--danger-6)';
        }

        return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 12, opacity: step.status === 'pending' ? 0.5 : 1 }}>
                <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>{icon}</div>
                <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--text-1)', fontSize: 14 }}>{step.labelZh}</span>
                {step.status === 'processing' && <span style={{ marginLeft: 'auto', fontSize: 12, color }}>处理中...</span>}
            </div>
        );
    };

    const isComplete = steps.every(s => s.status === 'success');

    return (
        <Popup
            visible={visible}
            onHiding={onClose}
            title={`正在部署: ${studentName || '项目'}`}
            showTitle={true}
            dragEnabled={false}
            width={700}
            height={600}
            showCloseButton={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Stepper */}
                <div style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
                    {steps.map(step => renderStep(step))}
                </div>

                {/* Log Viewer */}
                <div style={{
                    flex: 1,
                    backgroundColor: '#1E1E1E',
                    borderRadius: 4,
                    padding: 12,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    fontSize: 13,
                    color: '#D4D4D4',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ paddingBottom: 8, borderBottom: '1px solid #333', marginBottom: 8, color: '#888' }}>
                        控制台输出 (Console Output)
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {allLogs.map((log, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>
                                <span style={{ color: '#569CD6' }}>$</span> {log}
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {isComplete ? (
                        <>
                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--success-6)', marginRight: 'auto' }}>
                                <i className="dx-icon-check" style={{ marginRight: 4 }} /> 部署成功
                            </span>
                            {domain && (
                                <Button text="访问项目" type="default" stylingMode="text" onClick={() => window.open(`http://${domain}`, '_blank')} />
                            )}
                            <Button text="完成" type="success" onClick={onClose} />
                        </>
                    ) : (
                        <Button text="后台运行" type="normal" onClick={onClose} />
                    )}
                </div>
            </div>
        </Popup>
    );
};

export default DeploymentStatusModal;

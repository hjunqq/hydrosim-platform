import React, { useState, useEffect } from 'react';
import { Popup } from 'devextreme-react/popup';
import DataGrid, { Column, Paging, Scrolling } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import { buildsApi, Build } from '../api/builds';
import BuildProgress from './BuildProgress';

interface BuildHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    studentId?: number;
    studentName?: string;
}

const BuildHistoryModal: React.FC<BuildHistoryModalProps> = ({ visible, onClose, studentId, studentName }) => {
    const [builds, setBuilds] = useState<Build[]>([]);
    const [detailPopupVisible, setDetailPopupVisible] = useState(false);
    const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);

    const loadBuilds = async () => {
        if (!studentId) return;
        try {
            const data = await buildsApi.getBuilds({ student_id: studentId, limit: 50 }) as unknown as Build[];
            setBuilds(data);
        } catch (err) {
            console.error("Failed to load builds", err);
        }
    };

    useEffect(() => {
        if (visible && studentId) {
            setBuilds([]); // Clear previous data
            setDetailPopupVisible(false);
            setSelectedBuildId(null);
            loadBuilds();
            const interval = setInterval(loadBuilds, 10000);
            return () => clearInterval(interval);
        }
    }, [visible, studentId]);

    const handleViewDetail = (buildId: number) => {
        setSelectedBuildId(buildId);
        setDetailPopupVisible(true);
    };

    const statusCellRender = (data: any) => {
        const status = data.value;
        let color = '#999';
        let bg = '#eee';

        switch (status) {
            case 'success':
                color = 'var(--success-6)';
                bg = 'var(--success-1)';
                break;
            case 'running':
                color = 'var(--primary-6)';
                bg = 'var(--primary-1)';
                break;
            case 'failed':
            case 'error':
                color = 'var(--danger-6)';
                bg = 'var(--danger-1)';
                break;
            case 'pending':
                color = 'var(--warning-6)';
                bg = 'var(--warning-1)';
                break;
        }

        return (
            <span style={{
                background: bg, color: color,
                padding: '2px 8px', borderRadius: 4,
                fontWeight: 500, fontSize: 12
            }}>
                {status?.toUpperCase()}
            </span>
        );
    };

    return (
        <Popup
            visible={visible}
            onHiding={onClose}
            title={`构建记录 - ${studentName || ''}`}
            showTitle={true}
            dragEnabled={false}
            shading={true}
            showCloseButton={true}
            position="center"
            width={900}
            height={520}
        >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>构建历史 (Builds)</span>
                    <Button icon="refresh" stylingMode="text" onClick={loadBuilds} />
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                    <DataGrid
                        dataSource={builds}
                        showBorders={false}
                        columnAutoWidth={true}
                        rowAlternationEnabled={true}
                        noDataText="暂无构建记录"
                        height="100%"
                    >
                        <Scrolling mode="virtual" />
                        <Paging defaultPageSize={20} />

                        <Column dataField="id" caption="ID" width={60} />
                        <Column dataField="created_at" caption="开始时间" dataType="datetime" format="yyyy-MM-dd HH:mm" width={140} />
                        <Column dataField="branch" caption="分支" />
                        <Column dataField="commit_sha" caption="Commit" cellRender={d => d.value?.substring(0, 7)} width={100} />
                        <Column dataField="image_tag" caption="镜像 Tag" width={120} />
                        <Column dataField="status" caption="状态" cellRender={statusCellRender} width={100} alignment="center" />
                        <Column dataField="message" caption="信息" />
                        <Column
                            caption="操作"
                            width={100}
                            cellRender={(data) => (
                                <Button
                                    text="日志"
                                    type="normal"
                                    stylingMode="outlined"
                                    height={24}
                                    style={{ fontSize: 12 }}
                                    onClick={() => handleViewDetail(data.data.id)}
                                />
                            )}
                        />
                    </DataGrid>
                </div>
            </div>

            <Popup
                visible={detailPopupVisible}
                onHiding={() => setDetailPopupVisible(false)}
                title={`构建详情 #${selectedBuildId ?? ''}`}
                showTitle={true}
                dragEnabled={false}
                shading={true}
                showCloseButton={true}
                position="center"
                width={800}
                height={600}
                resizeEnabled={true}
            >
                <div style={{ height: '100%', overflow: 'auto' }}>
                    {selectedBuildId && studentId ? (
                        <BuildProgress
                            studentId={studentId}
                            buildId={selectedBuildId}
                        />
                    ) : <div style={{ padding: 20, color: '#999' }}>加载中...</div>}
                </div>
            </Popup>
        </Popup>
    );
};

export default BuildHistoryModal;

import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, Scrolling } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import Button from 'devextreme-react/button';
import { buildsApi, Build } from '../api/builds';
import BuildProgress from './BuildProgress';

interface BuildHistoryProps {
    studentId: number;
}

const BuildHistory: React.FC<BuildHistoryProps> = ({ studentId }) => {
    const [builds, setBuilds] = useState<Build[]>([]);
    const [detailPopupVisible, setDetailPopupVisible] = useState(false);
    const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
    const popupContainer = typeof document === 'undefined' ? undefined : document.body;

    const loadBuilds = async () => {
        try {
            const data = await buildsApi.getBuilds({ student_id: studentId, limit: 50 }) as unknown as Build[];
            setBuilds(data);
        } catch (err) {
            console.error("Failed to load builds", err);
        }
    };

    useEffect(() => {
        if (studentId) {
            setBuilds([]); // Clear previous data to prevent residue
            setDetailPopupVisible(false);
            setSelectedBuildId(null);
            loadBuilds();
            // Polling for history list updates
            const interval = setInterval(loadBuilds, 10000);
            return () => clearInterval(interval);
        }
    }, [studentId]);

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
        <div className="modern-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span className="card-title">构建历史 (Builds)</span>
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

            <Popup
                visible={detailPopupVisible}
                onHiding={() => setDetailPopupVisible(false)}
                title={`构建详情 #${selectedBuildId ?? ''}`}
                showTitle={true}
                dragEnabled={false}
                shading={true}
                showCloseButton={true}
                container={popupContainer}
                position="center"
                width={800}
                height={600}
                resizeEnabled={true}
            >
                <div style={{ height: '100%', overflow: 'auto' }}>
                    {selectedBuildId ? (
                        <BuildProgress
                            studentId={studentId}
                            buildId={selectedBuildId}
                        />
                    ) : <div style={{ padding: 20, color: '#999' }}>加载中...</div>}
                </div>
            </Popup>
        </div>
    );
};

export default BuildHistory;

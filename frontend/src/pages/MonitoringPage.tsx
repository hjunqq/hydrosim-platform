import React, { useEffect, useState } from 'react';
import { monitoringApi, ClusterOverview, NamespaceUsage } from '../api/monitoring';
import Chart, {
    ArgumentAxis,
    CommonSeriesSettings,
    Legend,
    Series,
    Tooltip,
    ValueAxis
} from 'devextreme-react/chart';
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';

const MonitoringPage: React.FC = () => {
    const [overview, setOverview] = useState<ClusterOverview | null>(null);
    const [namespaces, setNamespaces] = useState<NamespaceUsage[]>([]);
    const [loading, setLoading] = useState(true);

    // Mock history data for charts
    const [cpuHistory, setCpuHistory] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

    const rangeOptions = [
        { id: '1h', text: '近1小时', points: 12, step: 5, unit: 'm' },
        { id: '6h', text: '近6小时', points: 12, step: 30, unit: 'm' },
        { id: '24h', text: '近24小时', points: 12, step: 2, unit: 'h' }
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [overviewData, nsData] = await Promise.all([
                monitoringApi.getOverview(),
                monitoringApi.getNamespaceUsage()
            ]);
            setOverview(overviewData);
            setNamespaces(nsData);
            setCpuHistory(buildHistory(overviewData, timeRange));

        } catch (error) {
            console.error("Failed to load monitoring data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (overview) {
            setCpuHistory(buildHistory(overview, timeRange));
        }
    }, [overview, timeRange]);

    const buildHistory = (overviewData: ClusterOverview, rangeId: '1h' | '6h' | '24h') => {
        const range = rangeOptions.find((item) => item.id === rangeId) || rangeOptions[0];
        const baseCpu = overviewData.cpu_percentage || 15;
        const baseMemory = overviewData.memory_percentage || 20;

        return Array.from({ length: range.points }).map((_, i) => {
            const remaining = (range.points - i) * range.step;
            const timeLabel = range.unit === 'm' ? `${remaining}m前` : `${remaining}h前`;
            return {
                time: timeLabel,
                cpu: Math.max(0, baseCpu + (Math.random() * 10 - 5)),
                memory: Math.max(0, baseMemory + (Math.random() * 5 - 2))
            };
        });
    };

    return (
        <>
            <div className="top-bar">
                <div>
                    <h1 className="page-title">系统资源监控</h1>
                    <div className="page-subtitle">实时掌握集群负载与命名空间分布</div>
                </div>
                <div className="panel-actions">
                    <SelectBox
                        dataSource={rangeOptions}
                        valueExpr="id"
                        displayExpr="text"
                        value={timeRange}
                        width={140}
                        height={36}
                        onValueChanged={(e) => setTimeRange(e.value ?? '1h')}
                    />
                    <Button text="刷新数据" icon="refresh" onClick={loadData} stylingMode="contained" height={36} />
                </div>
            </div>

            <div className="content-scroll">
                {loading ? (
                    <div className="modern-card">
                        <div className="card-body">
                            <div className="empty-state">
                                <i className="dx-icon-refresh"></i>
                                <p>数据加载中...</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="panel-stack">
                        {/* Overview Cards */}
                        <div className="grid-stats">
                            <div className="stat-card stat-card-primary">
                                <div className="stat-header">
                                    <span className="stat-label">节点总数 (Nodes)</span>
                                    <span className="stat-icon"><i className="dx-icon-hierarchy"></i></span>
                                </div>
                                <div>
                                    <span className="stat-value">{overview?.nodes ?? '-'}</span>
                                    <span className="stat-unit">个</span>
                                </div>
                            </div>
                            <div className="stat-card stat-card-success">
                                <div className="stat-header">
                                    <span className="stat-label">Pod 总数</span>
                                    <span className="stat-icon"><i className="dx-icon-box"></i></span>
                                </div>
                                <div>
                                    <span className="stat-value">{overview?.pods ?? '-'}</span>
                                    <span className="stat-unit">个</span>
                                </div>
                            </div>
                            <div className="stat-card stat-card-warning">
                                <div className="stat-header">
                                    <span className="stat-label">CPU 使用率</span>
                                    <span className="stat-icon"><i className="dx-icon-percent"></i></span>
                                </div>
                                <div>
                                    <span className="stat-value" style={{ color: 'var(--warning-6)' }}>
                                        {overview?.cpu_percentage?.toFixed(1) ?? 0}
                                    </span>
                                    <span className="stat-unit">%</span>
                                </div>
                            </div>
                            <div className="stat-card stat-card-danger">
                                <div className="stat-header">
                                    <span className="stat-label">内存使用率</span>
                                    <span className="stat-icon"><i className="dx-icon-dataarea"></i></span>
                                </div>
                                <div>
                                    <span className="stat-value" style={{ color: 'var(--danger-6)' }}>
                                        {overview?.memory_percentage?.toFixed(1) ?? 0}
                                    </span>
                                    <span className="stat-unit">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid-2-1">
                            <div className="modern-card">
                                <div className="card-header">
                                    <span className="card-title">资源使用趋势</span>
                                </div>
                                <div className="card-body">
                                    {cpuHistory.length === 0 ? (
                                        <div className="empty-state">
                                            <i className="dx-icon-chart"></i>
                                            <p>暂无趋势数据</p>
                                        </div>
                                    ) : (
                                        <Chart
                                            id="chart"
                                            dataSource={cpuHistory}
                                            title=""
                                            height={300}
                                        >
                                            <CommonSeriesSettings argumentField="time" type="spline" />
                                            <Series valueField="cpu" name="CPU %" color="var(--primary-6)" />
                                            <Series valueField="memory" name="Memory %" color="var(--warning-6)" />
                                            <ArgumentAxis />
                                            <ValueAxis />
                                            <Legend verticalAlignment="bottom" horizontalAlignment="center" />
                                            <Tooltip enabled={true} />
                                        </Chart>
                                    )}
                                </div>
                            </div>

                            <div className="modern-card">
                                <div className="card-header">
                                    <span className="card-title">Namespace 分布</span>
                                </div>
                                <div className="card-body">
                                    {namespaces.length === 0 ? (
                                        <div className="empty-state">
                                            <i className="dx-icon-datapie"></i>
                                            <p>暂无 Namespace 数据</p>
                                        </div>
                                    ) : (
                                        <Chart dataSource={namespaces} height={300}>
                                            <Series
                                                valueField="active_pods"
                                                argumentField="namespace"
                                                name="Active Pods"
                                                type="bar"
                                                color="var(--success-6)"
                                            />
                                            <Legend visible={false} />
                                            <Tooltip enabled={true} />
                                        </Chart>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Anomaly/Detail List */}
                        <div className="modern-card">
                            <div className="card-header">
                                <span className="card-title">Namespace 资源详情</span>
                            </div>
                            <DataGrid
                                dataSource={namespaces}
                                showBorders={false}
                                columnAutoWidth={true}
                                rowAlternationEnabled={true}
                                noDataText="暂无数据"
                            >
                                <SearchPanel visible={true} width={240} placeholder="搜索命名空间..." />
                                <FilterRow visible={true} />
                                <Paging defaultPageSize={8} />
                                <Column dataField="namespace" caption="命名空间" />
                                <Column dataField="active_pods" caption="活跃 Pods" sortOrder="desc" />
                                <Column dataField="cpu" caption="CPU Limit" />
                                <Column dataField="memory" caption="Memory Limit" />
                            </DataGrid>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default MonitoringPage;

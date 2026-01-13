import React, { useState, useEffect } from 'react';
import DataGrid, { Column, Paging, FilterRow, SearchPanel } from 'devextreme-react/data-grid';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';

import { auditApi, AuditLog, AuditLogListResponse } from '../api/audit';
import TableSkeleton from '../components/TableSkeleton';
import './AuditPage.css';

const AuditPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);

    // Filters
    const [actionFilter, setActionFilter] = useState<string | null>(null);
    const [resourceFilter, setResourceFilter] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    // Options
    const [actionOptions, setActionOptions] = useState<string[]>([]);
    const [resourceOptions, setResourceOptions] = useState<string[]>([]);

    useEffect(() => {
        loadOptions();
        loadLogs();
    }, []);

    useEffect(() => {
        loadLogs();
    }, [page, actionFilter, resourceFilter, startDate, endDate]);

    const loadOptions = async () => {
        try {
            const [actions, resources] = await Promise.all([
                auditApi.getActionTypes(),
                auditApi.getResourceTypes()
            ]);
            setActionOptions(actions);
            setResourceOptions(resources);
        } catch (err) {
            console.error('Failed to load filter options', err);
        }
    };

    const loadLogs = async () => {
        try {
            setLoading(true);
            const result = await auditApi.list({
                action: actionFilter || undefined,
                resource_type: resourceFilter || undefined,
                start_date: startDate?.toISOString(),
                end_date: endDate?.toISOString(),
                page,
                page_size: pageSize
            });
            setLogs(result.items);
            setTotal(result.total);
        } catch (err: any) {
            notify(err.response?.data?.detail || '加载审计日志失败', 'error', 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setActionFilter(null);
        setResourceFilter(null);
        setStartDate(null);
        setEndDate(null);
        setPage(1);
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            'CREATE': '创建',
            'UPDATE': '更新',
            'DELETE': '删除',
            'DEPLOY': '部署',
            'BUILD': '构建',
            'LOGIN': '登录',
            'LOGOUT': '登出',
            'PASSWORD_RESET': '密码重置',
            'STATUS_CHANGE': '状态变更',
            'IMPORT': '导入',
            'EXPORT': '导出'
        };
        return labels[action] || action;
    };

    const getResourceLabel = (resource: string) => {
        const labels: Record<string, string> = {
            'student': '学生',
            'project': '项目',
            'deployment': '部署',
            'build': '构建',
            'build_config': '构建配置',
            'user': '用户',
            'system_settings': '系统设置'
        };
        return labels[resource] || resource;
    };

    const actionCellRender = (data: any) => {
        const colorMap: Record<string, string> = {
            'CREATE': '#52c41a',
            'UPDATE': '#1890ff',
            'DELETE': '#ff4d4f',
            'DEPLOY': '#722ed1',
            'BUILD': '#fa8c16',
            'LOGIN': '#13c2c2',
            'PASSWORD_RESET': '#eb2f96'
        };
        const color = colorMap[data.value] || '#666';
        return (
            <span style={{
                color,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '4px',
                background: `${color}15`
            }}>
                {getActionLabel(data.value)}
            </span>
        );
    };

    const resourceCellRender = (data: any) => (
        <span className="tag tag-gray">{getResourceLabel(data.value)}</span>
    );

    return (
        <>
            <div className="top-bar">
                <div>
                    <h1 className="page-title">审计日志</h1>
                    <div className="page-subtitle">查看系统操作记录和用户活动</div>
                </div>
                <div className="panel-actions">
                    <Button
                        text="刷新"
                        icon="refresh"
                        type="normal"
                        stylingMode="outlined"
                        onClick={loadLogs}
                        height={36}
                    />
                </div>
            </div>

            <div className="content-scroll">
                {/* Filters */}
                <div className="modern-card filter-card">
                    <div className="filter-row">
                        <div className="filter-item">
                            <label>操作类型</label>
                            <SelectBox
                                items={actionOptions}
                                value={actionFilter}
                                onValueChanged={(e) => setActionFilter(e.value)}
                                placeholder="全部"
                                showClearButton={true}
                                displayExpr={(item) => getActionLabel(item)}
                                width={150}
                            />
                        </div>
                        <div className="filter-item">
                            <label>资源类型</label>
                            <SelectBox
                                items={resourceOptions}
                                value={resourceFilter}
                                onValueChanged={(e) => setResourceFilter(e.value)}
                                placeholder="全部"
                                showClearButton={true}
                                displayExpr={(item) => getResourceLabel(item)}
                                width={150}
                            />
                        </div>
                        <div className="filter-item">
                            <label>开始日期</label>
                            <DateBox
                                value={startDate}
                                onValueChanged={(e) => setStartDate(e.value)}
                                type="datetime"
                                displayFormat="yyyy-MM-dd HH:mm"
                                showClearButton={true}
                                width={180}
                            />
                        </div>
                        <div className="filter-item">
                            <label>结束日期</label>
                            <DateBox
                                value={endDate}
                                onValueChanged={(e) => setEndDate(e.value)}
                                type="datetime"
                                displayFormat="yyyy-MM-dd HH:mm"
                                showClearButton={true}
                                width={180}
                            />
                        </div>
                        <Button
                            text="清除筛选"
                            icon="clear"
                            stylingMode="text"
                            onClick={handleClearFilters}
                        />
                    </div>
                </div>

                {/* Log Table */}
                <div className="modern-card">
                    {loading ? (
                        <TableSkeleton rows={10} />
                    ) : (
                        <DataGrid
                            dataSource={logs}
                            showBorders={false}
                            columnAutoWidth={true}
                            rowAlternationEnabled={true}
                            keyExpr="id"
                            width="100%"
                        >
                            <SearchPanel visible={true} width={250} placeholder="搜索..." />
                            <FilterRow visible={false} />
                            <Paging
                                enabled={true}
                                pageSize={pageSize}
                                pageIndex={page - 1}
                            />

                            <Column
                                dataField="created_at"
                                caption="时间"
                                dataType="datetime"
                                format="yyyy-MM-dd HH:mm:ss"
                                width={170}
                                sortOrder="desc"
                            />
                            <Column
                                dataField="action"
                                caption="操作"
                                width={100}
                                cellRender={actionCellRender}
                            />
                            <Column
                                dataField="resource_type"
                                caption="资源类型"
                                width={100}
                                cellRender={resourceCellRender}
                            />
                            <Column
                                dataField="resource_name"
                                caption="资源名称"
                                width={150}
                            />
                            <Column
                                dataField="username"
                                caption="操作者"
                                width={120}
                            />
                            <Column
                                dataField="user_role"
                                caption="角色"
                                width={80}
                                cellRender={(data) => (
                                    <span className={`tag ${data.value === 'admin' ? 'tag-blue' : ''}`}>
                                        {data.value === 'admin' ? '管理员' : data.value === 'teacher' ? '教师' : '学生'}
                                    </span>
                                )}
                            />
                            <Column
                                dataField="ip_address"
                                caption="IP地址"
                                width={130}
                            />
                            <Column
                                dataField="message"
                                caption="描述"
                                minWidth={200}
                            />
                        </DataGrid>
                    )}

                    {/* Pagination Info */}
                    <div className="pagination-info">
                        共 {total} 条记录，第 {page} 页
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuditPage;

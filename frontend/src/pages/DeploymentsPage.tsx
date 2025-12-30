import React, { useEffect, useState } from 'react'
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'
import { confirm } from 'devextreme/ui/dialog'
import request from '../api/request'

interface K8sResource {
    student_code: string
    project_type: string
    namespace: string
    deployment_name: string
    image: string
    replicas: string
    status: string
    created_at: string
}

const DeploymentsPage = () => {
    const [resources, setResources] = useState<K8sResource[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = async () => {
        try {
            setLoading(true)
            const data = await request.get<K8sResource[]>('/api/v1/deploy/resources/list')
            setResources(data as unknown as K8sResource[])
        } catch (err) {
            notify('Failed to load cluster resources', 'error', 3000)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (data: K8sResource) => {
        const result = await confirm(`确定要删除 ${data.student_code} 的部署吗? 此操作将移除所有相关 Pod 和服务。`, '确认删除')
        if (result) {
            try {
                // DELETE /api/v1/deploy/{student_code}?project_type={project_type}
                await request.delete(`/api/v1/deploy/${data.student_code}`, {
                    params: { project_type: data.project_type }
                })
                notify('部署已成功删除', 'success', 2000)
                loadData() // Refresh
            } catch (err) {
                notify('删除失败: ' + err, 'error', 3000)
            }
        }
    }

    useEffect(() => {
        loadData()
        const timer = setInterval(loadData, 5000) // Auto refresh
        return () => clearInterval(timer)
    }, [])

    const statusCellRender = (cellData: any) => {
        const isHealthy = cellData.value === 'Running'
        return (
            <span className={`status-badge ${isHealthy ? 'st-success' : 'st-danger'}`}>
                <span className="dot"></span>
                {cellData.value}
            </span>
        )
    }

    return (
        <>
            {/* Top Bar - consistent with other pages */}
            <div className="top-bar">
                <div>
                    <h1 className="page-title">部署记录 (Deployments)</h1>
                    <div className="page-subtitle">实时监控学生项目的 K8s Deployment 状态。</div>
                </div>
                <div className="panel-actions">
                    <Button text="刷新列表" icon="refresh" stylingMode="contained" onClick={loadData} height={36} />
                </div>
            </div>

            <div className="content-scroll">
                <div className="modern-card">
                    {loading ? (
                        <div className="card-body">
                            <div className="empty-state">
                                <i className="dx-icon-refresh"></i>
                                <p>数据加载中...</p>
                            </div>
                        </div>
                    ) : (
                        <DataGrid
                            dataSource={resources}
                            showBorders={false}
                            rowAlternationEnabled={true}
                            columnAutoWidth={true}
                            noDataText="暂无部署数据"
                        >
                            <SearchPanel visible={true} width={300} placeholder="搜索部署..." />
                            <FilterRow visible={true} />
                            <Paging defaultPageSize={20} />

                    <Column dataField="student_code" caption="学号 (Student Code)" sortOrder="asc" />
                    <Column dataField="deployment_name" caption="部署名称 (Deployment)" />
                    <Column dataField="namespace" caption="命名空间 (Namespace)" />
                    <Column dataField="image" caption="镜像 (Image)" />
                    <Column dataField="replicas" caption="副本数 (Ready/Target)" alignment="center" />
                    <Column dataField="status" caption="健康状态" cellRender={statusCellRender} alignment="center" />
                    <Column dataField="created_at" caption="创建时间" dataType="datetime" format="yyyy-MM-dd HH:mm:ss" />
                    <Column
                        caption="操作"
                        width={80}
                        alignment="center"
                        cellRender={(cellData) => (
                            <Button
                                icon="trash"
                                type="danger"
                                stylingMode="text"
                                onClick={() => handleDelete(cellData.data)}
                                hint="删除部署"
                            />
                        )}
                    />
                        </DataGrid>
                    )}
                </div>
            </div>
        </>
    )
}

export default DeploymentsPage

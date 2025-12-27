import React, { useEffect, useState } from 'react'
import DataGrid, { Column, Paging, SearchPanel } from 'devextreme-react/data-grid'
import notify from 'devextreme/ui/notify'
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
            // request interceptor returns data directly
            setResources(data as unknown as K8sResource[])
        } catch (err) {
            notify('Failed to load cluster resources', 'error', 3000)
        } finally {
            setLoading(false)
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
            <span style={{
                color: isHealthy ? 'var(--success-6)' : 'var(--danger-6)',
                fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6
            }}>
                <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isHealthy ? 'var(--success-1)' : 'var(--danger-1)',
                    border: `2px solid ${isHealthy ? 'var(--success-6)' : 'var(--danger-6)'}`
                }} />
                {cellData.value}
            </span>
        )
    }

    return (
        <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>Cluster Operations Center</h1>
                    <p style={{ color: 'var(--text-3)' }}>Real-time view of Kubernetes Deployments in student namespaces</p>
                </div>
                <button className="btn btn-primary" onClick={loadData}>Refresh</button>
            </div>

            <div className="modern-card">
                <DataGrid
                    dataSource={resources}
                    showBorders={false}
                    rowAlternationEnabled={true}
                    columnAutoWidth={true}
                >
                    <SearchPanel visible={true} width={300} placeholder="Search deployments..." />
                    <Paging defaultPageSize={20} />

                    <Column dataField="student_code" caption="Student Code" sortOrder="asc" />
                    <Column dataField="deployment_name" caption="K8s Deployment" />
                    <Column dataField="namespace" caption="Namespace" />
                    <Column dataField="image" caption="Image" />
                    <Column dataField="replicas" caption="Replicas (Ready/Target)" alignment="center" />
                    <Column dataField="status" caption="Health" cellRender={statusCellRender} alignment="center" />
                    <Column dataField="created_at" caption="Created At" dataType="datetime" />
                </DataGrid>
            </div>
        </div>
    )
}

export default DeploymentsPage

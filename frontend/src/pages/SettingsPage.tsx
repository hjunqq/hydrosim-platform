import React, { useState } from 'react';
import Form, { Item as FormItem, Label, GroupItem } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import DataGrid, { Column, Paging, Pager, HeaderFilter, SearchPanel } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { LoadPanel } from 'devextreme-react/load-panel';
import { settingsApi, SystemSetting, Semester } from '../api/settings';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<Partial<SystemSetting>>({});
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsData, semestersData] = await Promise.all([
                settingsApi.getSettings(),
                settingsApi.getSemesters()
            ]);
            setSettings(settingsData);
            setSemesters(semestersData);
        } catch (error) {
            console.error("Failed to load settings data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            setLoading(true);
            await settingsApi.updateSettings(settings);
            notify('系统设置已保存', 'success', 2000);
        } catch (error) {
            notify('保存失败', 'error', 2000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="top-bar">
                <div>
                    <h1 className="page-title">系统设置</h1>
                    <div className="page-subtitle">管理平台基础配置、学期及部署策略</div>
                </div>
            </div>

            <div className="content-scroll settings-container">
                <div className="settings-grid">
                    {/* Basic Configuration */}
                    <div className="modern-card settings-card">
                        <div className="card-header">
                            <span className="card-title">基础配置</span>
                            <i className="dx-icon-preferences" style={{ color: 'var(--primary-6)' }}></i>
                        </div>
                        <div className="card-body">
                            <Form formData={settings} labelLocation="top" colCount={2}>
                                <GroupItem colSpan={2}>
                                    <FormItem dataField="platform_name" editorType="dxTextBox" editorOptions={{ stylingMode: 'filled' }}>
                                        <Label text="平台名称" />
                                    </FormItem>
                                </GroupItem>
                                <FormItem dataField="portal_title" editorType="dxTextBox" editorOptions={{ stylingMode: 'filled' }}>
                                    <Label text="门户标题" />
                                </FormItem>
                                <FormItem dataField="env_type" editorType="dxSelectBox"
                                    editorOptions={{
                                        items: [
                                            { id: 'production', text: '生产环境' },
                                            { id: 'test', text: '测试环境' },
                                            { id: 'demo', text: '演示环境' }
                                        ],
                                        displayExpr: 'text',
                                        valueExpr: 'id',
                                        stylingMode: 'filled'
                                    }}
                                >
                                    <Label text="环境标识" />
                                </FormItem>
                                <FormItem dataField="domain_name" editorType="dxTextBox" editorOptions={{ stylingMode: 'filled' }}>
                                    <Label text="门户访问域名" />
                                </FormItem>
                                <FormItem dataField="timezone" editorType="dxSelectBox"
                                    editorOptions={{
                                        items: ['Asia/Shanghai', 'UTC', 'America/New_York'],
                                        stylingMode: 'filled'
                                    }}
                                >
                                    <Label text="默认时区" />
                                </FormItem>
                                <GroupItem colSpan={2}>
                                    <div className="settings-actions">
                                        <Button text="重置" stylingMode="text" onClick={loadData} />
                                        <Button text="保存更改" type="default" stylingMode="contained" onClick={handleSaveSettings} />
                                    </div>
                                </GroupItem>
                            </Form>
                        </div>
                    </div>
                </div>

                {/* Semester Management */}
                <div className="modern-card semester-list-section">
                    <div className="card-header">
                        <span className="card-title">学期管理</span>
                        <div className="panel-actions">
                            <Button icon="add" text="新增学期" type="default" stylingMode="text" height={32} />
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <DataGrid
                            dataSource={semesters}
                            keyExpr="id"
                            showBorders={false}
                            rowAlternationEnabled={true}
                            columnAutoWidth={true}
                        >
                            <SearchPanel visible={true} width={240} placeholder="搜索学期..." />
                            <HeaderFilter visible={true} />
                            <Paging defaultPageSize={5} />
                            <Pager showPageSizeSelector={true} allowedPageSizes={[5, 10]} showInfo={true} />

                            <Column dataField="name" caption="学期名称" />
                            <Column dataField="start_date" caption="开始日期" dataType="date" />
                            <Column dataField="end_date" caption="结束日期" dataType="date" />
                            <Column
                                dataField="is_active"
                                caption="状态"
                                cellRender={(data) => (
                                    <span className={`status-badge ${data.value ? 'st-success' : 'st-waiting'}`}>
                                        <span className="dot"></span>
                                        {data.value ? '进行中' : '已归档'}
                                    </span>
                                )}
                                width={120}
                            />
                            <Column type="buttons" width={100}>
                                <Button icon="edit" hint="编辑" />
                                <Button icon="trash" hint="删除" />
                            </Column>
                        </DataGrid>
                    </div>
                </div>
                <LoadPanel visible={loading} showPane={true} message="加载中..." />
            </div>
        </>
    );
};

export default SettingsPage;

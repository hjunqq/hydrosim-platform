import React, { useEffect, useState, useMemo } from 'react';
import { registryApi, Registry, CreateRegistryParams } from '../api/registry';
import DataGrid, { Column, Button as GridButton, Selection, HeaderFilter, SearchPanel, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import TreeView from 'devextreme-react/tree-view';
import { LoadPanel } from 'devextreme-react/load-panel';
import TextBox from 'devextreme-react/text-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';

import request from '../api/request';
import './RegistryPage.css';

const RegistryPage: React.FC = () => {
    const [registries, setRegistries] = useState<Registry[]>([]);
    const [loading, setLoading] = useState(true);
    const [repoSearch, setRepoSearch] = useState('');

    // Initial form state
    const initialFormState: CreateRegistryParams = {
        name: '',
        url: '',
        username: '',
        password: '',
        is_active: true
    };
    const [formData, setFormData] = useState<CreateRegistryParams>(initialFormState);
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    useEffect(() => {
        loadRegistries();
    }, []);

    const loadRegistries = async () => {
        try {
            setLoading(true);
            const data = await registryApi.list();
            setRegistries(data);
        } catch (error) {
            console.error("Failed to load registries", error);
            notify('加载镜像仓库失败', 'error', 2000);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRegistry = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await registryApi.create(formData);
            notify('镜像仓库添加成功', 'success', 2000);
            setIsPopupVisible(false);
            setFormData(initialFormState);
            loadRegistries();
        } catch (err: any) {
            notify(err.response?.data?.detail || '添加失败', 'error', 2000);
        }
    };

    const onFormOptionChanged = (e: any) => {
        if (e.dataField) {
            setFormData(prev => ({ ...prev, [e.dataField]: e.value }));
        }
    };

    const testConnection = async (data: any) => {
        try {
            const { url, username, password } = data;
            const res = await request.post<boolean>('/api/v1/admin/registries/test', {
                url, username, password
            });
            if (res) {
                notify('连接测试成功', 'success', 2000);
            } else {
                notify('连接测试失败', 'error', 2000);
            }
        } catch (err) {
            notify('测试连接出错', 'error', 2000);
        }
    }

    const handleDelete = async (e: any) => {
        try {
            await registryApi.delete(e.row.key);
            notify('删除成功', 'success', 2000);
            loadRegistries(); // refresh
        } catch (error) {
            notify('删除失败', 'error', 2000);
        }
    };

    // Registry Browser State
    const [browserData, setBrowserData] = useState<{
        registryId: number | null;
        rawRepositories: string[];
        currentRepo?: string;
        tags: string[];
        loading: boolean;
    }>({ registryId: null, rawRepositories: [], tags: [], loading: false });

    // Handle Registry Selection
    const handleRegistryClick = async (e: any) => {
        const registryId = e.data.id;
        if (browserData.registryId === registryId) return;

        try {
            setBrowserData(prev => ({ ...prev, registryId, loading: true, rawRepositories: [], tags: [], currentRepo: undefined }));
            const repos = await registryApi.getCatalog(registryId);
            setBrowserData({
                registryId,
                rawRepositories: repos,
                tags: [],
                loading: false
            });
        } catch (error) {
            setBrowserData(prev => ({ ...prev, registryId: null, loading: false }));
            notify('无法获取镜像列表，请检查连接状态', 'error', 2000);
        }
    };

    // Compute TreeView Items
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const groups: Set<string> = new Set();

        // Root nodes logic
        // We will group by "namespace" (part before slash).
        // If no slash, put in "Other" or root? Let's use root for no-slash and group folders for slash.

        browserData.rawRepositories.forEach(repo => {
            if (repo.includes('/')) {
                const parts = repo.split('/');
                const group = parts[0];
                const name = parts.slice(1).join('/');

                if (!groups.has(group)) {
                    groups.add(group);
                    items.push({
                        id: group,
                        text: group,
                        expanded: false,
                        icon: 'folder'
                    });
                }

                items.push({
                    id: repo,
                    text: name,
                    parentId: group,
                    icon: 'box',
                    isRepo: true // Custom flag
                });
            } else {
                // Root item
                items.push({
                    id: repo,
                    text: repo,
                    icon: 'box',
                    isRepo: true
                });
            }
        });

        return items;
    }, [browserData.rawRepositories]);

    const handleItemClick = (e: any) => {
        const item = e.itemData;
        if (item.isRepo) {
            handleRepoClick(item.id);
        }
    };

    const handleRepoClick = async (repo: string) => {
        if (!browserData.registryId) return;
        try {
            setBrowserData(prev => ({ ...prev, currentRepo: repo, tags: [] })); // Keep loading state separate? Or use LoadPanel
            // We use a small local loading for tags area if needed, but LoadPanel covers whole area or we add specific one.
            // Let's rely on browserData state updates to trigger "Getting tags..." UI if we want, or just await.
            const tags = await registryApi.getTags(browserData.registryId, repo);
            setBrowserData(prev => ({ ...prev, currentRepo: repo, tags }));
        } catch (error) {
            notify('无法获取Tags', 'error', 2000);
        }
    };

    const handleDeployImage = (repo: string, tag: string) => {
        const registry = registries.find(r => r.id === browserData.registryId);
        const fullImage = registry ? `${registry.url.replace('https://', '').replace('http://', '')}/${repo}:${tag}` : `${repo}:${tag}`;
        notify(`准备部署: ${fullImage}`, 'info', 3000);
    };

    const handleDeleteTag = async (repo: string, tag: string) => {
        if (!browserData.registryId) return;
        const result = await confirm(`确定要删除镜像版本 ${repo}:${tag} 吗? 此操作不可恢复。`, '确认删除');
        if (!result) return;

        try {
            await registryApi.deleteTag(browserData.registryId, repo, tag);
            notify(`镜像 ${repo}:${tag} 已删除`, 'success', 2000);
            handleRepoClick(repo);
        } catch (error: any) {
            notify(error.response?.data?.detail || '删除失败，请确认Registry允许删除操作', 'error', 3000);
        }
    };

    return (
        <>
            <div className="top-bar registry-header">
                <div>
                    <h1 className="page-title">镜像仓库管理</h1>
                    <div className="page-subtitle">管理容器镜像仓库配置 (Registry) 及查看镜像版本</div>
                </div>
                <div className="panel-actions">
                    <Button
                        text="添加仓库"
                        icon="add"
                        type="default"
                        stylingMode="contained"
                        onClick={() => setIsPopupVisible(true)}
                        height={36}
                    />
                </div>
            </div>

            <div className="content-scroll registry-page-container">
                {/* Registry List */}
                <div className="modern-card registry-list-section">
                    <div className="card-header">
                        <span className="card-title">仓库列表</span>
                        <span className="card-meta">共 {registries.length} 个仓库</span>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <DataGrid
                            dataSource={registries}
                            keyExpr="id"
                            showBorders={false}
                            rowAlternationEnabled={true}
                            columnAutoWidth={true}
                            focusedRowEnabled={true}
                            onRowClick={handleRegistryClick}
                            hoverStateEnabled={true}
                            noDataText="暂无仓库数据"
                        >
                            <SearchPanel visible={true} width={240} placeholder="搜索仓库..." />
                            <HeaderFilter visible={true} />
                            <Selection mode="single" />
                            <Paging defaultPageSize={5} />
                            <Pager showPageSizeSelector={true} allowedPageSizes={[5, 10, 20]} showInfo={true} />

                            <Column dataField="name" caption="名称" sortOrder="asc" />
                            <Column dataField="url" caption="URL地址" />
                            <Column dataField="username" caption="用户名" />
                            <Column
                                dataField="is_active"
                                caption="状态"
                                cellRender={(data) => (
                                    <span className={`status-badge ${data.value ? 'st-success' : 'st-waiting'}`}>
                                        <span className="dot"></span>
                                        {data.value ? '启用' : '禁用'}
                                    </span>
                                )}
                                width={100}
                            />
                            <Column type="buttons" caption="操作" width={120}>
                                <GridButton
                                    hint="测试连接"
                                    icon="check"
                                    onClick={(e) => testConnection(e.row.data)}
                                />
                                <GridButton
                                    name="delete"
                                    onClick={handleDelete}
                                />
                            </Column>
                        </DataGrid>
                    </div>
                    {!browserData.registryId && (
                        <div className="registry-hint">
                            <i className="dx-icon-info"></i>
                            请点击列表中的一行以浏览镜像内容
                        </div>
                    )}
                    <LoadPanel
                        shadingColor="rgba(255,255,255,0.4)"
                        position={{ of: '.registry-list-section' }}
                        visible={loading}
                        showIndicator={true}
                        showPane={true}
                        message="加载中..."
                    />
                </div>

                {/* Browser Section */}
                {browserData.registryId && (
                    <div className="repo-browser-card">
                        <div className="browser-header">
                            <div className="browser-title">
                                <i className="dx-icon-folder"></i>
                                镜像浏览器
                            </div>
                        </div>

                        <div className="browser-body">
                            {/* Sidebar */}
                            <div className="browser-sidebar">
                                <div className="sidebar-search">
                                    <div className="sidebar-label">镜像列表</div>
                                    <TextBox
                                        value={repoSearch}
                                        onValueChanged={(e) => setRepoSearch(e.value ?? '')}
                                        placeholder="搜索镜像..."
                                        showClearButton={true}
                                        stylingMode="filled"
                                    />
                                </div>
                                <div className="sidebar-tree-container">
                                    <TreeView
                                        items={treeItems}
                                        dataStructure="plain"
                                        keyExpr="id"
                                        displayExpr="text"
                                        parentIdExpr="parentId"
                                        searchEnabled={true}
                                        searchValue={repoSearch}
                                        searchMode="contains"
                                        onItemClick={handleItemClick}
                                        width="100%"
                                    />
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="browser-content">
                                <div className="tags-header">
                                    <div>
                                        {browserData.currentRepo ? (
                                            <span>当前镜像: <strong style={{ color: 'var(--text-1)' }}>{browserData.currentRepo}</strong></span>
                                        ) : (
                                            <span>请选择左侧镜像查看版本</span>
                                        )}
                                    </div>
                                    {browserData.tags.length > 0 && (
                                        <span className="dx-badge dx-badge-info">{browserData.tags.length} 版本</span>
                                    )}
                                </div>

                                <div className="tags-grid-container">
                                    {!browserData.currentRepo ? (
                                        <div className="empty-state">
                                            <i className="dx-icon-activefolder"></i>
                                            <p>在左侧选择一个镜像以查看可用版本</p>
                                        </div>
                                    ) : (
                                        <>
                                            {browserData.tags.length === 0 ? (
                                                <div className="empty-state">
                                                    <i className="dx-icon-warning"></i>
                                                    <p>未找到任何版本 (Tags)</p>
                                                </div>
                                            ) : (
                                                <div className="tags-grid">
                                                    {browserData.tags.map(tag => (
                                                        <div key={tag} className="tag-card">
                                                            <div className="tag-header">
                                                                <div className="tag-name">
                                                                    <i className="dx-icon-tags"></i>
                                                                    {tag}
                                                                </div>
                                                            </div>
                                                            <div className="tag-meta">
                                                                完整路径: {browserData.currentRepo}:{tag}
                                                            </div>
                                                            <div className="tag-actions">
                                                                <button
                                                                    className="action-btn btn-deploy"
                                                                    onClick={() => handleDeployImage(browserData.currentRepo!, tag)}
                                                                >
                                                                    <i className="dx-icon-upload"></i>
                                                                    部署
                                                                </button>
                                                                <button
                                                                    className="action-btn btn-delete"
                                                                    onClick={() => handleDeleteTag(browserData.currentRepo!, tag)}
                                                                >
                                                                    <i className="dx-icon-trash"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <LoadPanel
                            shadingColor="rgba(255,255,255,0.4)"
                            position={{ of: '.repo-browser-card' }}
                            visible={browserData.loading}
                            showIndicator={true}
                            showPane={true}
                            message="加载中..."
                        />
                    </div>
                )}

                {/* Create Registry Popup */}
                <Popup
                    visible={isPopupVisible}
                    onHiding={() => setIsPopupVisible(false)}
                    title="添加镜像仓库"
                    showTitle={true}
                    dragEnabled={false}
                    width={480}
                    height="auto"
                    showCloseButton={true}
                >
                    <form onSubmit={handleCreateRegistry} style={{ padding: '0 8px' }}>
                        <Form formData={formData} onFieldDataChanged={onFormOptionChanged} labelLocation="top">
                            <FormItem dataField="name" editorType="dxTextBox" editorOptions={{ placeholder: '例如: Harbor, AWS ECR' }}>
                                <Label text="仓库名称" />
                                <RequiredRule message="请输入名称" />
                            </FormItem>
                            <FormItem dataField="url" editorType="dxTextBox" editorOptions={{ placeholder: 'https://registry.example.com' }}>
                                <Label text="URL 地址" />
                                <RequiredRule message="请输入URL" />
                            </FormItem>
                            <FormItem dataField="username" editorType="dxTextBox">
                                <Label text="用户名" />
                                <RequiredRule message="请输入用户名" />
                            </FormItem>
                            <FormItem dataField="password" editorType="dxTextBox" editorOptions={{ mode: 'password' }}>
                                <Label text="密码 / Token" />
                                <RequiredRule message="请输入密码" />
                            </FormItem>
                            <FormItem dataField="is_active" editorType="dxCheckBox">
                                <Label text="立即启用" />
                            </FormItem>
                        </Form>
                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button text="取消" onClick={() => setIsPopupVisible(false)} type="normal" />
                            <Button text="确认添加" useSubmitBehavior={true} type="default" />
                        </div>
                    </form>
                </Popup>
            </div>
        </>
    );
};

export default RegistryPage;

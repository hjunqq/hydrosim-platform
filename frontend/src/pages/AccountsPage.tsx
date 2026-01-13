import React, { useState, useEffect, useRef } from 'react';
import DataGrid, { Column, FilterRow, Paging, SearchPanel, Selection } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';

import { studentsApi, Student, ImportResult, ResetPasswordResult } from '../api/students';
import TableSkeleton from '../components/TableSkeleton';
import './AccountsPage.css';

const AccountsPage: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

    // Modals
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false);
    const [isEditPopupVisible, setIsEditPopupVisible] = useState(false);
    const [isImportResultVisible, setIsImportResultVisible] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // Form Data
    const [newStudent, setNewStudent] = useState({
        student_code: '',
        name: '',
        project_type: 'gd' as 'gd' | 'cd',
        git_repo_url: '',
        expected_image_name: ''
    });
    const [editingStudent, setEditingStudent] = useState<Partial<Student>>({});
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [resetPasswordResult, setResetPasswordResult] = useState<ResetPasswordResult | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const data = await studentsApi.list() as unknown as Student[];
            setStudents(data);
        } catch (err) {
            notify('加载数据失败', 'error', 2000);
        } finally {
            setLoading(false);
        }
    };

    // ===== CRUD =====
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await studentsApi.create(newStudent);
            notify('账号创建成功', 'success', 2000);
            setIsCreatePopupVisible(false);
            setNewStudent({ student_code: '', name: '', project_type: 'gd', git_repo_url: '', expected_image_name: '' });
            loadStudents();
        } catch (err: any) {
            notify(err.response?.data?.detail || '创建失败', 'error', 3000);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent.id) return;
        try {
            await studentsApi.update(editingStudent.id, editingStudent);
            notify('账号更新成功', 'success', 2000);
            setIsEditPopupVisible(false);
            loadStudents();
        } catch (err: any) {
            notify(err.response?.data?.detail || '更新失败', 'error', 3000);
        }
    };

    const handleDelete = async (student: Student) => {
        const ok = await confirm(`确认删除账号 "${student.name}" (${student.student_code})？`, '删除确认');
        if (!ok) return;
        try {
            await studentsApi.delete(student.id);
            notify('账号已删除', 'success', 2000);
            loadStudents();
        } catch (err: any) {
            notify(err.response?.data?.detail || '删除失败', 'error', 3000);
        }
    };

    // ===== Password Reset =====
    const handleResetPassword = async (student: Student) => {
        const ok = await confirm(`确认重置 "${student.name}" 的密码？将生成新的随机密码。`, '重置密码');
        if (!ok) return;
        try {
            const result = await studentsApi.resetPassword(student.id);
            console.log('Password reset result:', result);
            setResetPasswordResult(result);
            setIsPasswordVisible(true);
            notify('密码已重置', 'success', 2000);
        } catch (err: any) {
            console.error('Password reset error:', err);
            notify(err.response?.data?.detail || '重置失败', 'error', 3000);
        }
    };

    // ===== Status Toggle =====
    const handleToggleStatus = async (student: Student) => {
        const newStatus = !student.is_active;
        const action = newStatus ? '启用' : '禁用';
        const ok = await confirm(`确认${action}账号 "${student.name}"？`, `${action}账号`);
        if (!ok) return;
        try {
            await studentsApi.toggleStatus(student.id, newStatus);
            notify(`账号已${action}`, 'success', 2000);
            loadStudents();
        } catch (err: any) {
            notify(err.response?.data?.detail || `${action}失败`, 'error', 3000);
        }
    };

    // ===== Batch Operations =====
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await studentsApi.importStudents(file);
            setImportResult(result);
            setIsImportResultVisible(true);
            if (result.success > 0) {
                loadStudents();
            }
        } catch (err: any) {
            notify(err.response?.data?.detail || '导入失败', 'error', 3000);
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExport = async () => {
        try {
            const response = await studentsApi.exportStudents();
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            notify('导出成功', 'success', 2000);
        } catch (err: any) {
            notify('导出失败', 'error', 3000);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await studentsApi.downloadTemplate();
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'student_import_template.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            notify('下载模板失败', 'error', 3000);
        }
    };

    // ===== Render Helpers =====
    const statusCellRender = (cellData: any) => {
        const isActive = cellData.data.is_active !== false;
        return (
            <span className={`status-badge ${isActive ? 'st-success' : 'st-danger'}`}>
                <span className="dot" style={{ background: isActive ? '#52c41a' : '#ff4d4f' }} />
                {isActive ? '正常' : '禁用'}
            </span>
        );
    };

    return (
        <>
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                style={{ display: 'none' }}
            />

            {/* Top Bar */}
            <div className="top-bar">
                <div>
                    <h1 className="page-title">账号管理</h1>
                    <div className="page-subtitle">管理学生账号、密码重置、批量导入导出</div>
                </div>
                <div className="panel-actions">
                    <Button
                        text="下载模板"
                        icon="download"
                        type="normal"
                        stylingMode="text"
                        onClick={handleDownloadTemplate}
                        height={36}
                    />
                    <Button
                        text="导入"
                        icon="import"
                        type="normal"
                        stylingMode="outlined"
                        onClick={handleImportClick}
                        height={36}
                    />
                    <Button
                        text="导出"
                        icon="export"
                        type="normal"
                        stylingMode="outlined"
                        onClick={handleExport}
                        height={36}
                    />
                    <Button
                        text="刷新"
                        icon="refresh"
                        type="normal"
                        stylingMode="outlined"
                        onClick={loadStudents}
                        height={36}
                    />
                    <Button
                        text="新建账号"
                        icon="add"
                        type="default"
                        stylingMode="contained"
                        onClick={() => setIsCreatePopupVisible(true)}
                        height={36}
                    />
                </div>
            </div>

            <div className="content-scroll">
                <div className="modern-card">
                    {loading ? (
                        <TableSkeleton rows={8} />
                    ) : (
                        <DataGrid
                            dataSource={students}
                            showBorders={false}
                            focusedRowEnabled={true}
                            columnAutoWidth={false}
                            columnMinWidth={100}
                            allowColumnResizing={true}
                            columnResizingMode="widget"
                            keyExpr="id"
                            rowAlternationEnabled={true}
                            selectedRowKeys={selectedRowKeys}
                            onSelectedRowKeysChange={setSelectedRowKeys}
                            width="100%"
                        >
                            <SearchPanel visible={true} width={300} placeholder="搜索学号、姓名..." />
                            <FilterRow visible={true} />
                            <Paging defaultPageSize={15} />
                            <Selection mode="multiple" showCheckBoxesMode="always" />

                            <Column dataField="student_code" caption="学号" width={140} fixed={true} />
                            <Column dataField="name" caption="姓名" width={120} fixed={true} />
                            <Column
                                dataField="project_type"
                                caption="项目类型"
                                width={100}
                                cellRender={(data) => (
                                    <span className={`tag ${data.value === 'gd' ? 'tag-blue' : 'tag-gray'}`}>
                                        {data.value === 'gd' ? '毕业设计' : '课程设计'}
                                    </span>
                                )}
                            />
                            <Column
                                dataField="is_active"
                                caption="状态"
                                width={90}
                                cellRender={statusCellRender}
                                alignment="center"
                            />
                            <Column dataField="domain" caption="域名" width={200} />
                            <Column
                                dataField="created_at"
                                caption="创建时间"
                                dataType="datetime"
                                format="yyyy-MM-dd HH:mm"
                                width={160}
                            />
                            <Column
                                caption="操作"
                                width={280}
                                fixed={true}
                                fixedPosition="right"
                                alignment="center"
                                cellRender={(data) => {
                                    const student = data.data as Student;
                                    const isActive = student.is_active !== false;
                                    return (
                                        <div className="table-actions">
                                            <Button
                                                text="编辑"
                                                icon="edit"
                                                type="normal"
                                                stylingMode="outlined"
                                                onClick={() => {
                                                    setEditingStudent({ ...student });
                                                    setIsEditPopupVisible(true);
                                                }}
                                                height={28}
                                            />
                                            <Button
                                                text="重置密码"
                                                icon="key"
                                                type="normal"
                                                stylingMode="outlined"
                                                onClick={() => handleResetPassword(student)}
                                                height={28}
                                            />
                                            <Button
                                                text={isActive ? '禁用' : '启用'}
                                                icon={isActive ? 'remove' : 'check'}
                                                type="normal"
                                                stylingMode="text"
                                                onClick={() => handleToggleStatus(student)}
                                                height={28}
                                            />
                                            <Button
                                                icon="trash"
                                                type="danger"
                                                stylingMode="text"
                                                onClick={() => handleDelete(student)}
                                                height={28}
                                                hint="删除"
                                            />
                                        </div>
                                    );
                                }}
                            />
                        </DataGrid>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <Popup
                visible={isCreatePopupVisible}
                onHiding={() => setIsCreatePopupVisible(false)}
                title="新建学生账号"
                showTitle={true}
                dragEnabled={false}
                width={480}
                height="auto"
            >
                <form onSubmit={handleCreate}>
                    <Form formData={newStudent} onFieldDataChanged={(e) => {
                        if (e.dataField) setNewStudent(prev => ({ ...prev, [e.dataField!]: e.value }));
                    }}>
                        <FormItem dataField="student_code">
                            <Label text="学号" />
                            <RequiredRule message="学号不能为空" />
                        </FormItem>
                        <FormItem dataField="name">
                            <Label text="姓名" />
                            <RequiredRule message="姓名不能为空" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [
                                    { id: 'gd', text: '毕业设计' },
                                    { id: 'cd', text: '课程设计' }
                                ],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="项目类型" />
                        </FormItem>
                        <FormItem dataField="git_repo_url">
                            <Label text="Git 仓库 (可选)" />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsCreatePopupVisible(false)} type="normal" />
                        <Button text="创建" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup>

            {/* Edit Modal */}
            <Popup
                visible={isEditPopupVisible}
                onHiding={() => setIsEditPopupVisible(false)}
                title="编辑学生账号"
                showTitle={true}
                dragEnabled={false}
                width={480}
                height="auto"
            >
                <form onSubmit={handleEdit}>
                    <Form formData={editingStudent} onFieldDataChanged={(e) => {
                        if (e.dataField) setEditingStudent(prev => ({ ...prev, [e.dataField!]: e.value }));
                    }}>
                        <FormItem dataField="student_code">
                            <Label text="学号" />
                            <RequiredRule message="学号不能为空" />
                        </FormItem>
                        <FormItem dataField="name">
                            <Label text="姓名" />
                            <RequiredRule message="姓名不能为空" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [
                                    { id: 'gd', text: '毕业设计' },
                                    { id: 'cd', text: '课程设计' }
                                ],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="项目类型" />
                        </FormItem>
                        <FormItem dataField="git_repo_url">
                            <Label text="Git 仓库" />
                        </FormItem>
                        <FormItem dataField="expected_image_name">
                            <Label text="预期镜像名" />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsEditPopupVisible(false)} type="normal" />
                        <Button text="保存" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup>

            {/* Import Result Modal */}
            <Popup
                visible={isImportResultVisible}
                onHiding={() => setIsImportResultVisible(false)}
                title="导入结果"
                showTitle={true}
                showCloseButton={true}
                dragEnabled={false}
                width={600}
                height="auto"
            >
                {importResult && (
                    <div className="import-result">
                        <div className="import-stats">
                            <div className="stat-item stat-total">
                                <div className="stat-value">{importResult.total}</div>
                                <div className="stat-label">总计</div>
                            </div>
                            <div className="stat-item stat-success">
                                <div className="stat-value">{importResult.success}</div>
                                <div className="stat-label">成功</div>
                            </div>
                            <div className="stat-item stat-failed">
                                <div className="stat-value">{importResult.failed}</div>
                                <div className="stat-label">失败</div>
                            </div>
                        </div>

                        {importResult.errors.length > 0 && (
                            <div className="import-errors">
                                <h4>错误详情</h4>
                                <table className="error-table">
                                    <thead>
                                        <tr>
                                            <th>行号</th>
                                            <th>学号</th>
                                            <th>错误</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importResult.errors.slice(0, 10).map((err, i) => (
                                            <tr key={i}>
                                                <td>{err.row}</td>
                                                <td>{err.student_code || '-'}</td>
                                                <td>{err.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importResult.errors.length > 10 && (
                                    <p className="more-errors">还有 {importResult.errors.length - 10} 个错误未显示</p>
                                )}
                            </div>
                        )}

                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Button text="关闭" onClick={() => setIsImportResultVisible(false)} type="default" />
                        </div>
                    </div>
                )}
            </Popup>

            {/* Password Reset Result Modal */}
            <Popup
                visible={isPasswordVisible}
                onHiding={() => setIsPasswordVisible(false)}
                title="密码已重置"
                showTitle={true}
                showCloseButton={true}
                dragEnabled={false}
                width={400}
                height="auto"
                contentRender={() => (
                    <div className="password-result">
                        {resetPasswordResult && (
                            <div className="password-info">
                                <p>学生: <strong>{resetPasswordResult.student_name}</strong> ({resetPasswordResult.student_code})</p>
                                <div className="new-password">
                                    <span>新密码:</span>
                                    <code>{resetPasswordResult.new_password}</code>
                                </div>
                                <p className="password-hint">请将此密码告知学生，建议首次登录后立即修改。</p>
                            </div>
                        )}
                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Button text="确定" onClick={() => setIsPasswordVisible(false)} type="default" />
                        </div>
                    </div>
                )}
            />
        </>
    );
};

export default AccountsPage;

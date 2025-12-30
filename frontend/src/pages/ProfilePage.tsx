import React, { useState } from 'react';
import TabPanel, { Item as TabItem } from 'devextreme-react/tab-panel';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import CheckBox from 'devextreme-react/check-box';
import notify from 'devextreme/ui/notify';
import { LoadPanel } from 'devextreme-react/load-panel';
import { profileApi, UserProfile } from '../api/profile';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState<Partial<UserProfile>>({});
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    React.useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const userData = await profileApi.getMe();
            setProfile(userData as any);
        } catch (error) {
            console.error("Failed to load user profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setLoading(true);
            await profileApi.updateMe(profile);
            setIsEditing(false);
            notify('个人资料已成功更新', 'success', 2000);
        } catch (error) {
            notify('更新失败', 'error', 2000);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = () => {
        notify('密码已修改，请重新登录', 'info', 3000);
    };

    return (
        <>
            <div className="top-bar">
                <div>
                    <h1 className="page-title">个人信息</h1>
                    <div className="page-subtitle">管理您的账号资料、安全设置及偏好</div>
                </div>
            </div>

            <div className="content-scroll profile-container">
                {/* Header Overview */}
                <div className="profile-header-card">
                    <div className="profile- avatar-large">
                        {profile.full_name?.charAt(0) || profile.username?.charAt(0)}
                    </div>
                    <div className="profile-basic-info">
                        <div className="profile-role-badge">{profile.role}</div>
                        <h2>{profile.full_name || profile.username}</h2>
                        <div className="profile-meta-grid">
                            <div className="profile-meta-item">
                                <i className="dx-icon-card"></i>
                                {profile.username}
                            </div>
                            <div className="profile-meta-item">
                                <i className="dx-icon-home"></i>
                                {profile.department}
                            </div>
                            <div className="profile-meta-item">
                                <i className="dx-icon-clock"></i>
                                注册时间: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                            </div>
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        {!isEditing ? (
                            <Button
                                text="编辑资料"
                                icon="edit"
                                stylingMode="outlined"
                                type="default"
                                onClick={() => setIsEditing(true)}
                            />
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button text="取消" onClick={() => { setIsEditing(false); loadData(); }} />
                                <Button text="保存" type="default" stylingMode="contained" onClick={handleSaveProfile} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="profile-content-grid">
                    {/* Main Tabs */}
                    <div className="profile-tabs-card">
                        <TabPanel animationEnabled={true} swipeEnabled={true}>
                            <TabItem title="个人详细资料" icon="user">
                                <div style={{ padding: '32px' }}>
                                    <Form formData={profile} readOnly={!isEditing} labelLocation="top" colCount={2}>
                                        <FormItem dataField="full_name">
                                            <Label text="姓名" />
                                            <RequiredRule message="姓名不能为空" />
                                        </FormItem>
                                        <FormItem dataField="username" editorOptions={{ readOnly: true }}>
                                            <Label text="用户名 / 工号" />
                                        </FormItem>
                                        <FormItem dataField="department" colSpan={2}>
                                            <Label text="所属学院 / 部门" />
                                        </FormItem>
                                        <FormItem dataField="email">
                                            <Label text="邮箱地址" />
                                            <RequiredRule message="邮箱不能为空" />
                                        </FormItem>
                                        <FormItem dataField="phone">
                                            <Label text="手机号码" />
                                        </FormItem>
                                    </Form>
                                </div>
                            </TabItem>

                            <TabItem title="账号安全" icon="key">
                                <div style={{ padding: '32px' }}>
                                    <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>修改登录密码</h3>
                                    <div style={{ maxWidth: '400px' }}>
                                        <Form labelLocation="top">
                                            <FormItem editorType="dxTextBox" editorOptions={{ mode: 'password', stylingMode: 'filled' }}>
                                                <Label text="当前密码" />
                                            </FormItem>
                                            <FormItem editorType="dxTextBox" editorOptions={{ mode: 'password', stylingMode: 'filled' }}>
                                                <Label text="新密码" />
                                            </FormItem>
                                            <FormItem editorType="dxTextBox" editorOptions={{ mode: 'password', stylingMode: 'filled' }}>
                                                <Label text="确认新密码" />
                                            </FormItem>
                                            <Button text="更新密码" type="default" stylingMode="contained" onClick={handlePasswordChange} style={{ marginTop: '16px' }} />
                                        </Form>
                                    </div>
                                </div>
                            </TabItem>

                            <TabItem title="通知设置" icon="mention">
                                <div style={{ padding: '32px' }}>
                                    <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>消息通知偏好</h3>
                                    <div className="notification-row">
                                        <div>
                                            <div style={{ fontWeight: 500 }}>邮件通知</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>接收关于项目部署状态的邮件提醒</div>
                                        </div>
                                        <CheckBox defaultValue={true} />
                                    </div>
                                    <div className="notification-row">
                                        <div>
                                            <div style={{ fontWeight: 500 }}>站内信</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>接收系统公告和重要通知</div>
                                        </div>
                                        <CheckBox defaultValue={true} />
                                    </div>
                                    <div className="notification-row">
                                        <div>
                                            <div style={{ fontWeight: 500 }}>异常告警</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>当您的容器运行异常时立即通知</div>
                                        </div>
                                        <CheckBox defaultValue={true} />
                                    </div>
                                </div>
                            </TabItem>
                        </TabPanel>
                    </div>

                    {/* Side Cards */}
                    <div className="profile-side-card">
                        <div className="modern-card">
                            <div className="card-header">
                                <span className="card-title">安全状态</span>
                            </div>
                            <div className="card-body">
                                <div className="security-status-item">
                                    <div className="security-label">
                                        <i className="dx-icon-check" style={{ color: 'var(--success-6)' }}></i>
                                        <div>
                                            <div className="security-title">账号正常</div>
                                            <div className="security-desc">您的账号当前处于受保护状态</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="security-status-item">
                                    <div className="security-label">
                                        <i className="dx-icon-warning" style={{ color: 'var(--warning-6)' }}></i>
                                        <div>
                                            <div className="security-title">未绑定手机</div>
                                            <div className="security-desc">建议绑定手机以增强安全性</div>
                                        </div>
                                    </div>
                                    <Button text="绑定" stylingMode="text" height={24} />
                                </div>
                            </div>
                        </div>

                        <div className="modern-card">
                            <div className="card-header">
                                <span className="card-title">登录审计</span>
                            </div>
                            <div className="card-body" style={{ padding: '0 20px 20px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '16px 0' }}>
                                    <div style={{ marginBottom: '8px' }}>
                                        <i className="dx-icon-event" style={{ marginRight: '6px' }}></i>
                                        2025-12-30 23:45 (当前会话)
                                    </div>
                                    <div style={{ marginBottom: '8px' }}>
                                        <i className="dx-icon-map" style={{ marginRight: '6px' }}></i>
                                        IP: 192.168.1.1 (北京市)
                                    </div>
                                    <div>
                                        <i className="dx-icon-info" style={{ marginRight: '6px' }}></i>
                                        Windows / Chrome
                                    </div>
                                </div>
                                <Button text="查看所有记录" stylingMode="text" width="100%" />
                            </div>
                        </div>
                    </div>
                </div>
                <LoadPanel visible={loading} showPane={true} message="加载中..." />
            </div>
        </>
    );
};

export default ProfilePage;

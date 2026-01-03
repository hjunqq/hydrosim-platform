import React, { useState, useEffect } from 'react';
import { Popup } from 'devextreme-react/popup';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { buildConfigsApi, BuildConfig } from '../api/buildConfigs';

interface BuildConfigModalProps {
    visible: boolean;
    onClose: () => void;
    studentId: number;
    onSaved?: () => void;
}

const BuildConfigModal: React.FC<BuildConfigModalProps> = ({ visible, onClose, studentId, onSaved }) => {
    const [config, setConfig] = useState<Partial<BuildConfig>>({});
    const [loading, setLoading] = useState(false);
    const [keyLoading, setKeyLoading] = useState(false);

    useEffect(() => {
        if (visible && studentId) {
            loadConfig();
        }
    }, [visible, studentId]);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const data = await buildConfigsApi.getConfig(studentId);
            setConfig(data || {});
        } catch (err) {
            console.error("Failed to load config", err);
            // If 404, empty config is fine, logic handled in backend or default empty
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await buildConfigsApi.updateConfig(studentId, config);
            notify('配置已保存', 'success', 2000);
            if (onSaved) onSaved();
            onClose();
        } catch (err: any) {
            notify(err.response?.data?.detail || '保存失败', 'error', 3000);
        }
    };

    const handleFormChange = (e: any) => {
        setConfig(prev => ({ ...prev, [e.dataField]: e.value }));
    };

    const handleGenerateKey = async (force: boolean) => {
        if (!studentId) return;
        try {
            setKeyLoading(true);
            const data = await buildConfigsApi.generateDeployKey(studentId, force);
            setConfig(data || {});
            notify(force ? 'Deploy key rotated' : 'Deploy key created', 'success', 2000);
        } catch (err: any) {
            notify(err.response?.data?.detail || 'Deploy key generation failed', 'error', 3000);
        } finally {
            setKeyLoading(false);
        }
    };

    return (
        <Popup
            visible={visible}
            onHiding={onClose}
            title="构建配置 (Build Configuration)"
            showTitle={true}
            dragEnabled={false}
            width={600}
            height="auto"
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
            ) : (
                <form onSubmit={handleSave}>
                    <Form formData={config} onFieldDataChanged={handleFormChange}>

                        <FormItem itemType="group" caption="代码仓库">
                            <FormItem dataField="repo_url">
                                <Label text="Git Repo URL" />
                                <RequiredRule />
                            </FormItem>
                            <FormItem dataField="branch">
                                <Label text="Branch (e.g. main)" />
                                <RequiredRule />
                            </FormItem>
                        </FormItem>

                        <FormItem itemType="group" caption="Docker 构建">
                            <FormItem dataField="dockerfile_path">
                                <Label text="Dockerfile Path" />
                                <RequiredRule />
                            </FormItem>
                            <FormItem dataField="context_path">
                                <Label text="Build Context Path" />
                                <RequiredRule />
                            </FormItem>
                            <FormItem dataField="image_repo">
                                <Label text="Target Image Repo (Registry)" />
                            </FormItem>
                        </FormItem>

                        <FormItem itemType="group" caption="自动化">
                            <FormItem
                                dataField="auto_build"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '推送代码时自动构建' }}
                            >
                                <Label text="Auto Build" visible={false} />
                            </FormItem>
                            <FormItem
                                dataField="auto_deploy"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '构建成功后自动部署' }}
                            >
                                <Label text="Auto Deploy" visible={false} />
                            </FormItem>
                        </FormItem>

                        <FormItem
                            itemType="group"
                            caption="Deploy Key"
                            render={() => (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                        ??? Key ??? Gitea Deploy Key??????????
                                    </div>
                                    <pre style={{
                                        background: 'var(--fill-2)',
                                        padding: 12,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        minHeight: 80,
                                        margin: 0
                                    }}>
                                        {config.deploy_key_public || '???? Deploy Key'}
                                    </pre>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Button
                                            text={config.deploy_key_public ? '??? Key' : '??? Key'}
                                            type="default"
                                            stylingMode="outlined"
                                            disabled={keyLoading}
                                            onClick={() => handleGenerateKey(Boolean(config.deploy_key_public))}
                                        />
                                        {config.deploy_key_fingerprint && (
                                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                                ???: {config.deploy_key_fingerprint}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        />

                        <div style={{ marginTop: 24, textAlign: 'right' }}>
                            <Button text="取消" onClick={onClose} type="normal" stylingMode="outlined" style={{ marginRight: 10 }} />
                            <Button text="保存配置" useSubmitBehavior={true} type="default" />
                        </div>
                    </Form>
                </form>
            )}
        </Popup>
    );
};

export default BuildConfigModal;

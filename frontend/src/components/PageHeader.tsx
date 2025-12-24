import React from 'react';
import Button from 'devextreme-react/button';

interface PageHeaderProps {
    title: string;
    breadcrumbs?: { text: string; onClick?: () => void }[];
    actions?: {
        text: string;
        icon?: string;
        type?: 'normal' | 'default' | 'success' | 'danger';
        onClick: () => void;
    }[];
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, breadcrumbs = [], actions = [] }) => {
    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px 24px',
            borderBottom: '1px solid #DFE1E6',
            marginBottom: '10px', // Spacing from content
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div>
                {breadcrumbs.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#6B778C', marginBottom: '8px' }}>
                        {breadcrumbs.map((crumb, index) => (
                            <span key={index}>
                                {index > 0 && ' / '}
                                <span
                                    style={{ cursor: crumb.onClick ? 'pointer' : 'default', color: crumb.onClick ? '#0056D2' : 'inherit' }}
                                    onClick={crumb.onClick}
                                >
                                    {crumb.text}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#172B4D' }}>{title}</h1>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                {actions.map((action, index) => (
                    <Button
                        key={index}
                        text={action.text}
                        icon={action.icon}
                        type={action.type || 'normal'}
                        onClick={action.onClick}
                        stylingMode="contained"
                    />
                ))}
            </div>
        </div>
    );
};

export default PageHeader;

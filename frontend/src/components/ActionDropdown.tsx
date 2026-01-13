import React, { useCallback } from 'react';
import { DropDownButton } from 'devextreme-react/drop-down-button';
import Button from 'devextreme-react/button';
import './ActionDropdown.css';

export interface ActionItem {
    id: string;
    text: string;
    icon?: string;
    disabled?: boolean;
    type?: 'normal' | 'default' | 'success' | 'danger';
}

interface ActionDropdownProps {
    /** 主操作 - 直接显示为按钮 */
    primaryAction?: ActionItem;
    /** 下拉菜单项 */
    items: ActionItem[];
    /** 点击事件回调 */
    onItemClick: (id: string) => void;
    /** 下拉按钮图标 */
    dropdownIcon?: string;
    /** 下拉按钮文本 */
    dropdownText?: string;
    /** 是否禁用 */
    disabled?: boolean;
}

/**
 * 操作下拉菜单组件
 * 用于 DataGrid 表格中的操作列，支持主操作按钮 + 下拉菜单组合
 * 
 * @example
 * <ActionDropdown
 *   primaryAction={{ id: 'monitor', text: '监控', icon: 'chart' }}
 *   items={[
 *     { id: 'deploy', text: '部署', icon: 'upload' },
 *     { id: 'delete', text: '删除', icon: 'trash', type: 'danger' }
 *   ]}
 *   onItemClick={handleAction}
 * />
 */
export const ActionDropdown: React.FC<ActionDropdownProps> = ({
    primaryAction,
    items,
    onItemClick,
    dropdownIcon = 'more',
    dropdownText,
    disabled = false
}) => {
    const handleItemClick = useCallback((e: any) => {
        const itemId = e.itemData?.id;
        if (itemId) {
            onItemClick(itemId);
        }
    }, [onItemClick]);

    const handlePrimaryClick = useCallback(() => {
        if (primaryAction) {
            onItemClick(primaryAction.id);
        }
    }, [primaryAction, onItemClick]);

    return (
        <div className="action-dropdown-container">
            {primaryAction && (
                <Button
                    text={primaryAction.text}
                    icon={primaryAction.icon}
                    type={primaryAction.type || 'normal'}
                    stylingMode="outlined"
                    disabled={disabled || primaryAction.disabled}
                    onClick={handlePrimaryClick}
                    height={28}
                    className="action-dropdown-primary"
                />
            )}
            {items.length > 0 && (
                <DropDownButton
                    text={dropdownText}
                    icon={dropdownIcon}
                    items={items}
                    displayExpr="text"
                    keyExpr="id"
                    onItemClick={handleItemClick}
                    disabled={disabled}
                    stylingMode="outlined"
                    dropDownOptions={{
                        width: 160,
                    }}
                    height={28}
                    className="action-dropdown-menu"
                    itemRender={(item: ActionItem) => (
                        <div className={`dropdown-item ${item.type === 'danger' ? 'dropdown-item-danger' : ''}`}>
                            {item.icon && <i className={`dx-icon-${item.icon}`} />}
                            <span>{item.text}</span>
                        </div>
                    )}
                />
            )}
        </div>
    );
};

export default ActionDropdown;

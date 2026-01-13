import React from 'react';
import './TableSkeleton.css';

interface TableSkeletonProps {
    /** 骨架屏行数 */
    rows?: number;
    /** 列配置，用于自定义每列宽度 */
    columns?: { width: string }[];
}

/**
 * 表格骨架屏组件
 * 用于 DataGrid 数据加载时显示占位动画
 * 
 * @example
 * <TableSkeleton rows={5} columns={[
 *   { width: '15%' },
 *   { width: '20%' },
 *   { width: '40%' },
 *   { width: '25%' }
 * ]} />
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
    rows = 5,
    columns = [
        { width: '12%' },
        { width: '15%' },
        { width: '10%' },
        { width: '8%' },
        { width: '8%' },
        { width: '22%' },
        { width: '12%' },
        { width: '13%' }
    ]
}) => {
    return (
        <div className="table-skeleton">
            {/* Header row */}
            <div className="skeleton-header">
                {columns.map((col, i) => (
                    <div key={`h-${i}`} className="skeleton-header-cell" style={{ width: col.width }}>
                        <div className="skeleton-box skeleton-header-box" />
                    </div>
                ))}
            </div>

            {/* Body rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={rowIndex}
                    className="skeleton-row"
                    style={{ animationDelay: `${rowIndex * 50}ms` }}
                >
                    {columns.map((col, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className="skeleton-cell" style={{ width: col.width }}>
                            <div className="skeleton-box" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default TableSkeleton;

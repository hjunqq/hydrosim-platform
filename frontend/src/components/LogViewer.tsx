import React, { useEffect, useRef, useState, useCallback } from 'react';
import Button from 'devextreme-react/button';
import './LogViewer.css';

interface LogViewerProps {
    /** WebSocket URL to connect to */
    wsUrl: string;
    /** Title for the log viewer */
    title?: string;
    /** Maximum number of lines to keep */
    maxLines?: number;
    /** Whether to auto-scroll to bottom */
    autoScroll?: boolean;
    /** Height of the log viewer */
    height?: number | string;
    /** Callback when connection status changes */
    onConnectionChange?: (connected: boolean) => void;
}

interface LogMessage {
    id: number;
    type: string;
    data?: string;
    message?: string;
    timestamp: Date;
}

const LogViewer: React.FC<LogViewerProps> = ({
    wsUrl,
    title = '日志',
    maxLines = 1000,
    autoScroll = true,
    height = 400,
    onConnectionChange,
}) => {
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const messageIdRef = useRef(0);

    const scrollToBottom = useCallback(() => {
        if (containerRef.current && autoScroll && !paused) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [autoScroll, paused]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                setError(null);
                onConnectionChange?.(true);
                addLog({ type: 'system', message: '已连接到日志服务' });
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    addLog(data);
                } catch {
                    addLog({ type: 'log', data: event.data });
                }
            };

            ws.onerror = () => {
                setError('连接错误');
            };

            ws.onclose = () => {
                setConnected(false);
                onConnectionChange?.(false);
                addLog({ type: 'system', message: '连接已断开' });
            };
        } catch (err) {
            setError(`无法连接: ${err}`);
        }
    }, [wsUrl, onConnectionChange]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const addLog = useCallback((data: any) => {
        setLogs((prev) => {
            const newLog: LogMessage = {
                id: ++messageIdRef.current,
                type: data.type || 'log',
                data: data.data,
                message: data.message,
                timestamp: new Date(),
            };
            const updated = [...prev, newLog];
            // Keep only last maxLines
            if (updated.length > maxLines) {
                return updated.slice(-maxLines);
            }
            return updated;
        });
    }, [maxLines]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [logs, scrollToBottom]);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [wsUrl]);

    const getLogLineClass = (type: string) => {
        switch (type) {
            case 'error':
                return 'log-line-error';
            case 'warning':
            case 'warn':
                return 'log-line-warning';
            case 'system':
            case 'connected':
            case 'info':
                return 'log-line-info';
            default:
                return '';
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-CN', { hour12: false });
    };

    return (
        <div className="log-viewer">
            <div className="log-viewer-header">
                <div className="log-viewer-title">
                    <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
                    {title}
                    <span className="log-count">({logs.length} 行)</span>
                </div>
                <div className="log-viewer-actions">
                    <Button
                        icon={paused ? 'play' : 'pause'}
                        hint={paused ? '继续滚动' : '暂停滚动'}
                        stylingMode="text"
                        onClick={() => setPaused(!paused)}
                    />
                    <Button
                        icon="trash"
                        hint="清空日志"
                        stylingMode="text"
                        onClick={clearLogs}
                    />
                    <Button
                        icon={connected ? 'close' : 'refresh'}
                        hint={connected ? '断开连接' : '重新连接'}
                        stylingMode="text"
                        onClick={connected ? disconnect : connect}
                    />
                </div>
            </div>

            {error && (
                <div className="log-viewer-error">
                    <i className="dx-icon-warning" />
                    {error}
                </div>
            )}

            <div
                ref={containerRef}
                className="log-viewer-content"
                style={{ height: typeof height === 'number' ? `${height}px` : height }}
            >
                {logs.length === 0 ? (
                    <div className="log-empty">
                        <i className="dx-icon-doc" />
                        <span>等待日志...</span>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className={`log-line ${getLogLineClass(log.type)}`}>
                            <span className="log-time">{formatTime(log.timestamp)}</span>
                            <span className="log-content">
                                {log.data || log.message || JSON.stringify(log)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LogViewer;

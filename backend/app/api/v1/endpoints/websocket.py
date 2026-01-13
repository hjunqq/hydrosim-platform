"""
WebSocket endpoint for real-time build/deployment logs.
"""
import asyncio
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.services.monitoring_service import monitoring_service

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[str, list] = {}
    
    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
        logger.info(f"WebSocket connected to room: {room}")
    
    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            if websocket in self.active_connections[room]:
                self.active_connections[room].remove(websocket)
            if not self.active_connections[room]:
                del self.active_connections[room]
        logger.info(f"WebSocket disconnected from room: {room}")
    
    async def send_message(self, message: str, room: str):
        if room in self.active_connections:
            for connection in self.active_connections[room]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Failed to send message: {e}")
    
    async def broadcast(self, message: str):
        for room in self.active_connections.values():
            for connection in room:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass


manager = ConnectionManager()


@router.websocket("/logs/{pod_name}")
async def websocket_pod_logs(
    websocket: WebSocket,
    pod_name: str,
    namespace: str = Query("default"),
    container: Optional[str] = Query(None),
    tail_lines: int = Query(100),
):
    """
    Stream pod logs via WebSocket.
    
    Connect to: ws://host/api/v1/ws/logs/{pod_name}?namespace=xxx&container=yyy
    """
    room = f"logs:{namespace}:{pod_name}"
    await manager.connect(websocket, room)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "message": f"Connected to logs for {pod_name}",
            "namespace": namespace,
            "container": container,
        })
        
        # Start log streaming
        async for log_line in stream_pod_logs(namespace, pod_name, container, tail_lines):
            await websocket.send_json({
                "type": "log",
                "data": log_line,
            })
            
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from {room}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
            })
        except:
            pass
    finally:
        manager.disconnect(websocket, room)


async def stream_pod_logs(
    namespace: str, 
    pod_name: str, 
    container: Optional[str], 
    tail_lines: int
):
    """
    Async generator that streams pod logs.
    Uses kubernetes client to watch logs.
    """
    if not getattr(monitoring_service, 'v1', None):
        yield "[Error] Kubernetes client not available"
        return
    
    try:
        # First, get recent logs
        logs = monitoring_service.v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            container=container,
            tail_lines=tail_lines,
            follow=False,
        )
        
        for line in logs.split('\n'):
            if line.strip():
                yield line
        
        # Then stream new logs
        # Note: For true streaming, we would use the 'follow=True' option
        # but that requires async handling of the kubernetes client
        # For simplicity, we'll poll every 2 seconds
        last_logs = logs
        while True:
            await asyncio.sleep(2)
            new_logs = monitoring_service.v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=namespace,
                container=container,
                tail_lines=50,
                follow=False,
            )
            
            # Find new lines
            if new_logs != last_logs:
                new_lines = new_logs.split('\n')
                old_lines = set(last_logs.split('\n'))
                for line in new_lines:
                    if line.strip() and line not in old_lines:
                        yield line
                last_logs = new_logs
                
    except Exception as e:
        yield f"[Error] Failed to stream logs: {e}"


@router.websocket("/build/{build_id}")
async def websocket_build_logs(
    websocket: WebSocket,
    build_id: int,
):
    """
    Stream build logs via WebSocket.
    
    Connect to: ws://host/api/v1/ws/build/{build_id}
    """
    room = f"build:{build_id}"
    await manager.connect(websocket, room)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": f"Connected to build {build_id} logs",
            "build_id": build_id,
        })
        
        # TODO: Implement actual build log streaming
        # This would integrate with the build service
        await websocket.send_json({
            "type": "info",
            "message": "Build log streaming is in development",
        })
        
        # Keep connection alive
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
            
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from {room}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, room)

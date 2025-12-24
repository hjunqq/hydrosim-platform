#!/bin/bash
# 部署管理门户到 k3s 集群

set -e

NAMESPACE="hydrosim"

echo "===================================="
echo "部署管理门户到 k3s"
echo "===================================="

# 创建命名空间
echo "1. 创建命名空间..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# 应用基础配置
echo "2. 应用基础配置..."
kubectl apply -f ../../deploy/base/

# 部署后端
echo "3. 部署后端服务..."
kubectl apply -f ../../deploy/backend/

# 部署前端
echo "4. 部署前端服务..."
kubectl apply -f ../../deploy/frontend/

# 配置 Ingress
echo "5. 配置 Ingress..."
kubectl apply -f ../../deploy/ingress/

echo "===================================="
echo "部署完成！"
echo "===================================="
echo "访问地址："
echo "- 前端: http://your-domain.com"
echo "- 后端 API: http://your-domain.com/api"
echo "===================================="

import React from 'react'

const SystemGuidePage = () => {
  const envBlock = `DB_DRIVER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=student_12345
DB_USER=student_user
DB_PASS=student_pass
PORT=8080
DATA_DIR=/data
DB_FILE=/data/app.db`
  const minioBlock = `MINIO_ENDPOINT=minio.infra.svc.cluster.local:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=hydrosim-platform
MINIO_SECURE=false`

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">系统说明</h1>
          <div className="page-subtitle">平台架构与数据持久化策略（面向教师/运维）</div>
        </div>
      </div>

      <div className="content-scroll">
        <div className="panel-stack">
          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">系统结构概览</span>
            </div>
            <div className="card-body">
              <ul className="help-list">
                <li>门户前端/后端：Hydrosim 教师管理门户与 API 服务。</li>
                <li>数据库：门户数据库 + 学生项目数据库。</li>
                <li>K3s 集群：承载学生项目与数据库实例。</li>
                <li>对象存储：MinIO 作为备份与归档存储。</li>
                <li>Ingress：对外暴露访问域名与入口。</li>
              </ul>
            </div>
          </div>

          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">多租户隔离模型</span>
            </div>
            <div className="card-body">
              <ul className="help-list">
                <li>命名空间：每个学生项目独立命名空间，例如 student-12345。</li>
                <li>资源限制：通过 ResourceQuota + LimitRange 限制 CPU/内存/存储。</li>
                <li>网络隔离：NetworkPolicy 默认拒绝跨 Namespace 访问。</li>
                <li>RBAC：门户服务账号拥有学生命名空间内的 CRUD 权限。</li>
              </ul>
            </div>
          </div>

          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">数据库持久化策略</span>
            </div>
            <div className="card-body">
              <ul className="help-list">
                <li>默认数据库：PostgreSQL。</li>
                <li>门户数据库：StatefulSet + PVC，默认 500Mi。</li>
                <li>学生数据库：每个学生项目单独一套 StatefulSet + PVC，默认 500Mi。</li>
                <li>存储类：local-path-retain（本地持久化，PVC 删除后数据保留）。</li>
                <li>单节点说明：节点宕机时服务不可用，但数据保留。</li>
              </ul>
            </div>
          </div>

          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">学生侧应用配置规范</span>
            </div>
            <div className="card-body">
              <div className="help-section">
                <div className="help-section-title">环境变量示例</div>
                <pre className="help-code">{envBlock}</pre>
              </div>
              <div className="help-note">学生仅需选择驱动并读取环境变量，镜像入口保持单 Web 服务。</div>
            </div>
          </div>

          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">备份策略（7/30）</span>
            </div>
            <div className="card-body">
              <ul className="help-list">
                <li>每日备份：保留 7 天。</li>
                <li>每周备份：保留 30 天。</li>
                <li>备份目标：MinIO（集群内访问）。</li>
              </ul>
              <div className="help-section">
                <div className="help-section-title">MinIO 配置（集群内访问）</div>
                <pre className="help-code">{minioBlock}</pre>
              </div>
            </div>
          </div>

          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">运维与支持</span>
            </div>
            <div className="card-body">
              <ul className="help-list">
                <li>门户提示常见故障：ImagePullBackOff / CrashLoopBackOff / 数据库连接失败。</li>
                <li>自动展示命名空间资源使用情况。</li>
                <li>预留入口：一键备份 / 重建数据库 / 迁移数据。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default SystemGuidePage

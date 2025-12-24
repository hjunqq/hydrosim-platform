import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TextBox from 'devextreme-react/text-box'
import notify from 'devextreme/ui/notify'
import { useAuth } from '../contexts/AuthContext'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      notify('请输入账号和密码', 'error', 2000)
      return
    }

    setLoading(true)
    try {
      await login({ username, password })
      notify('登录成功', 'success', 1000)
      navigate('/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.detail || '登录失败，请检查账号密码'
      notify(msg, 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left Panel - Brand */}
      <div className="login-left">
        <div className="circle c1"></div>
        <div className="circle c2"></div>
        <div className="brand-intro">
          <h1>Hydrosim Portal</h1>
          <p>专业的教学计算容器托管平台<br />为工程教育提供稳定、高效的云端基础设施</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="login-right">
        <div className="login-container">
          <div className="welcome-text">
            <h2>欢迎回来</h2>
            <span>请输入您的教师账号以继续管理课程</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-item">
              <label className="form-label">账号 (Username)</label>
              <TextBox
                value={username}
                onValueChanged={(e) => setUsername(e.value)}
                placeholder="请输入教师工号或邮箱"
                height={48}
                stylingMode="outlined"
              />
            </div>

            <div className="form-item">
              <label className="form-label">密码 (Password)</label>
              <TextBox
                mode="password"
                value={password}
                onValueChanged={(e) => setPassword(e.value)}
                placeholder="请输入您的密码"
                height={48}
                stylingMode="outlined"
              />
            </div>

            <div className="login-actions">
              <label className="checkbox-wrapper">
                <input type="checkbox" /> <span>记住我</span>
              </label>
              <a
                href="#"
                className="forget-link"
                onClick={(e) => {
                  e.preventDefault()
                  notify('请联系管理员重置密码', 'info', 3000)
                }}
              >
                忘记密码？
              </a>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="login-footer">
            Hydrosim Platform &copy; 2025 Created by Engineering Dept.
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi, LoginParams, LoginResponse } from '../api/auth'

interface User {
    id?: number
    username: string
    role?: string
}

interface AuthContextType {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (params: LoginParams) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
    const [isLoading, setIsLoading] = useState<boolean>(true)

    useEffect(() => {
        // Initial check
        const storedToken = localStorage.getItem('token')
        const storedUser = localStorage.getItem('user')
        if (storedToken && storedUser) {
            setToken(storedToken)
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error("Failed to parse user from storage", e);
                localStorage.removeItem('token')
                localStorage.removeItem('user')
            }
        }
        setIsLoading(false)
    }, [])

    const login = async (params: LoginParams) => {
        try {
            // request.ts returns the response.data object directly
            const res = await authApi.login(params) as unknown as LoginResponse & { role: string }
            const { access_token, username, role, user_id } = res as any
            const userObj = { id: user_id, username, role }

            setToken(access_token)
            setUser(userObj)
            localStorage.setItem('token', access_token)
            localStorage.setItem('user', JSON.stringify(userObj))
        } catch (error) {
            throw error
        }
    }

    const logout = () => {
        setToken(null)
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

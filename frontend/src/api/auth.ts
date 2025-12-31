import request from './request'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  username: string
}

export const authApi = {
  login(data: LoginParams) {
    return request.post<LoginResponse>('/api/v1/auth/login/', data)
  }
}

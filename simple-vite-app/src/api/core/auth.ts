import { baseRequestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return {
    id: 0,
    password: '123456',
    realName: 'Vben',
    roles: ['super'],
    username: 'vben',
    accessToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MCwicGFzc3dvcmQiOiIxMjM0NTYiLCJyZWFsTmFtZSI6IlZiZW4iLCJyb2xlcyI6WyJzdXBlciJdLCJ1c2VybmFtZSI6InZiZW4iLCJpYXQiOjE3NDkwODU4OTQsImV4cCI6MTc0OTY5MDY5NH0.x9Gq2K0OydOVnvOmeyA4c0j9ZxRF6QHu5AAk_eOTKZo',
  };
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    withCredentials: true,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return ['AC_100100', 'AC_100110', 'AC_100120', 'AC_100010'];
}

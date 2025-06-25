/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return {
    code: 0,
    data: {
      id: 0,
      realName: 'Vben',
      roles: ['super'],
      username: 'vben',
    },
    error: null,
    message: 'ok',
  };
}

// 类型导入
import type { AxiosResponse } from 'axios';
import axios from 'axios';

// Vue 相关（您原来有用 polling）
import { onUnmounted, ref } from 'vue';

// 创建 axios 实例
const instance = axios.create({
  timeout: 8000,
  validateStatus() {
    // 所有 HTTP 状态都 resolve，不主动 throw
    return true;
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 这里可自动加 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers['Authorization'] = `Bearer ${token}`;
    // }

    return config;
  },
  (error) => {
    // 请求阶段出错
    return Promise.reject(error);
  },
);

// 响应拦截器
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const resData = response.data;
    const code = resData?.code;

    if (code === 0 || code === 200) {
      // 成功，返回整个 resData，包含 code/msg/data
      return resData;
    } else {
      // 失败，统一 reject，抛 message 或默认文案
      return Promise.reject(resData?.message || '请求异常');
    }
  },
  (error) => {
    // 网络层异常（超时 / 断网 / DNS / CORS）
    return Promise.reject(error?.message || '网络异常');
  },
);

export default instance;

// ===== 保留您原有的 polling 工具部分 =====

// 直接请求外部 URL 获取端口状态
export async function fetchPortStatus(url: string): Promise<any> {
  try {
    const res = await axios.get(url, {
      validateStatus: () => true, // 防止非 200 throw
    });
    // 兼容结构，取 data.data
    return res.data?.data || {};
  } catch {
    return null;
  }
}

// 定时轮询，返回响应式数据
export function usePolling(url: string, interval = 3000) {
  const data = ref(null);
  let timer: any = null;

  async function getData() {
    data.value = await fetchPortStatus(url);
  }

  getData();
  timer = setInterval(getData, interval);

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return data;
}

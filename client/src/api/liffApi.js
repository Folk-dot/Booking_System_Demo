import axios from 'axios';

const liffApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}/api`,
  timeout: 10000,
});

liffApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('trainee_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

liffApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('trainee_token');
      // window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default liffApi;

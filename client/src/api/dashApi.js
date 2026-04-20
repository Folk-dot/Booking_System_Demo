import axios from 'axios';

const dashApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/v1',
  timeout: 10000,
});

dashApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('trainer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

dashApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('trainer_token');
      localStorage.removeItem('trainer_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default dashApi;

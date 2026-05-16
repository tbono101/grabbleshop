import api from './api.js';
export const register   = (data)  => api.post('/auth/register', data);
export const login      = (data)  => api.post('/auth/login', data);
export const refresh    = (token) => api.post('/auth/refresh', { refreshToken: token });
export const logout     = (token) => api.post('/auth/logout',  { refreshToken: token });
export const getMe      = ()      => api.get('/auth/me');

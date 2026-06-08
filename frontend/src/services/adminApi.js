import api from './api.js';

export const getStats  = ()             => api.get('/admin/stats');
export const listUsers = (params = {})  => api.get('/admin/users', { params });
export const getUser   = (id)           => api.get(`/admin/users/${id}`);
export const updateUser = (id, data)    => api.patch(`/admin/users/${id}`, data);
export const listSellers = (params = {}) => api.get('/admin/sellers', { params });

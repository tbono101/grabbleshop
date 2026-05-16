import api from './api.js';
export const listMyOrders      = (p)      => api.get('/orders/mine', { params: p });
export const listSellerOrders  = (p)      => api.get('/orders/seller', { params: p });
export const getOrder          = (id)     => api.get(`/orders/${id}`);
export const cancelOrder       = (id)     => api.post(`/orders/${id}/cancel`);
export const applyTax          = (id, d)  => api.post(`/orders/${id}/tax`, d);
export const updateOrderStatus = (id, d)  => api.patch(`/orders/${id}/status`, d);
export const addReview         = (id, d)  => api.post(`/orders/${id}/review`, d);

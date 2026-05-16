import api from './api.js';
export const createCheckout      = (orderId) => api.post('/payments/checkout', { orderId });
export const getPaymentStatus    = (orderId) => api.get(`/payments/status/${orderId}`);
export const getSellerDashboard  = ()        => api.get('/payments/seller/dashboard');

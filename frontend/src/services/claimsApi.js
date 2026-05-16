import api from './api.js';
export const createClaim    = (data) => api.post('/claims', data);
export const releaseClaim   = (id)   => api.post(`/claims/${id}/release`);
export const confirmClaim   = (id, d)=> api.post(`/claims/${id}/confirm`, d);
export const getMyClaims    = ()     => api.get('/claims/mine');
export const getEventClaims = (eid)  => api.get(`/claims/event/${eid}`);

import api from './api.js';
export const createListing       = (data)   => api.post('/listings', data);
export const updateListing       = (id, d)  => api.patch(`/listings/${id}`, d);
export const deleteListing       = (id)     => api.delete(`/listings/${id}`);
export const activateListing     = (id)     => api.post(`/listings/${id}/activate`);
export const deactivateListing   = (id)     => api.post(`/listings/${id}/deactivate`);
export const generateDescription = (id)     => api.post(`/listings/${id}/generate-description`);
export const uploadImages        = (id, fd) => api.post(`/listings/${id}/images`, fd, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const deleteImage = (id, imgId) => api.delete(`/listings/${id}/images/${imgId}`);

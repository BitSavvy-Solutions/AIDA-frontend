/**
 * Thin client for the aida-vault service.
 * Authenticates with the shared aidaToken (ethikey_) issued by the portal.
 */
import config from '../config/apiConfig';

const request = async (path, { method = 'GET', body } = {}) => {
    const token = localStorage.getItem('aidaToken');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${config.VAULT_URL}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

    if (!res.ok) {
        const detail = data?.detail;
        const err = new Error(
            (typeof detail === 'object' && detail?.error) ||
            (typeof detail === 'string' && detail) ||
            `Vault request failed (${res.status})`
        );
        err.status = res.status;
        err.detail = detail;
        throw err;
    }
    return data?.data ?? data;
};

export const vaultApi = {
    listProfiles:        () => request('/profiles'),
    createProfile:       (payload) => request('/profiles', { method: 'POST', body: payload }),
    updateProfile:       (id, payload) => request(`/profiles/${id}`, { method: 'PATCH', body: payload }),
    deleteProfile:       (id) => request(`/profiles/${id}`, { method: 'DELETE' }),
    getSnapshotMeta:     (id) => request(`/profiles/${id}/snapshot/meta`),
    presign:             (id, sizeBytes, baseVersion) =>
        request(`/profiles/${id}/snapshot/presign`, { method: 'POST', body: { sizeBytes, baseVersion } }),
    commit:              (id, reservationId, baseVersion, deviceLabel) =>
        request(`/profiles/${id}/snapshot/commit`, { method: 'POST', body: { reservationId, baseVersion, deviceLabel } }),
    getSnapshotDownload: (id, version) =>
        request(`/profiles/${id}/snapshot${version != null ? `?version=${version}` : ''}`),
    getUsage:            () => request('/usage'),
};

export const uploadBlob = async (uploadUrl, buffer) => {
    const res = await fetch(uploadUrl, { method: 'PUT', body: buffer });
    if (!res.ok) throw new Error(`Blob upload failed (${res.status})`);
};

export const downloadBlob = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blob download failed (${res.status})`);
    return res.arrayBuffer();
};
/**
 * All cryptography for profiles. WebCrypto only, zero dependencies.
 */
const te = new TextEncoder();
const td = new TextDecoder();

export const KDF_ALGO = 'PBKDF2-SHA256';
export const KDF_ITERATIONS = 600000;
const VERIFIER_PLAINTEXT = 'aida-profile-v1';

export const bytesToB64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
};

export const b64ToBytes = (b64) => {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
};

export const deriveKEK = async (password, saltB64, iterations = KDF_ITERATIONS) => {
    const pwKey = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations, hash: 'SHA-256' },
        pwKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['wrapKey', 'unwrapKey']
    );
};

export const generateDEK = () =>
    crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const wrapDEK = async (dek, kek) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv });
    const out = new Uint8Array(12 + wrapped.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(wrapped), 12);
    return bytesToB64(out);
};

export class BadPasswordError extends Error {
    constructor() { super('Incorrect password'); this.name = 'BadPasswordError'; }
}

export const unwrapDEK = async (wrappedB64, kek, { extractable = false } = {}) => {
    const raw = b64ToBytes(wrappedB64);
    const iv = raw.slice(0, 12);
    const data = raw.slice(12);
    try {
        return await crypto.subtle.unwrapKey(
            'raw', data, kek, { name: 'AES-GCM', iv },
            { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']
        );
    } catch {
        throw new BadPasswordError();
    }
};

export const makeVerifier = async (dek) => {
    const buf = await encryptSnapshot(dek, { ok: VERIFIER_PLAINTEXT });
    return bytesToB64(buf);
};

export const checkVerifier = async (dek, verifierB64) => {
    try {
        const obj = await decryptSnapshot(dek, b64ToBytes(verifierB64).buffer);
        return obj?.ok === VERIFIER_PLAINTEXT;
    } catch {
        return false;
    }
};

export const encryptSnapshot = async (dek, obj) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, te.encode(JSON.stringify(obj)));
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ct), 12);
    return out.buffer;
};

export const decryptSnapshot = async (dek, buffer) => {
    const bytes = new Uint8Array(buffer);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ct);
    return JSON.parse(td.decode(plain));
};

export const generateRecoveryKey = async () => {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
    const b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0, display = '';
    for (const byte of raw) {
        value = (value << 8) | byte; bits += 8;
        while (bits >= 5) {
            display += b32[(value >>> (bits - 5)) & 31]; bits -= 5;
        }
    }
    if (bits > 0) display += b32[(value << (5 - bits)) & 31];
    return { key, display: display.match(/.{1,4}/g).join('-') };
};

export const recoveryKeyFromDisplay = (display) => {
    const b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = display.replace(/-/g, '').toUpperCase();
    let bits = 0, value = 0;
    const out = [];
    for (const ch of clean) {
        value = (value << 5) | b32.indexOf(ch); bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return crypto.subtle.importKey('raw', new Uint8Array(out), { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
};
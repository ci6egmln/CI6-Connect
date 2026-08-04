const encoder = new TextEncoder();

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function base64UrlToBytes(value) {
  const base64 = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(signature);
}

async function hkdfExtract(salt, inputKeyMaterial) {
  return hmacSha256(salt, inputKeyMaterial);
}

async function hkdfExpand(pseudoRandomKey, info, length) {
  const block = await hmacSha256(
    pseudoRandomKey,
    concatBytes(info, new Uint8Array([1]))
  );
  return block.slice(0, length);
}

function normalizeEcdsaSignature(signature) {
  const bytes = new Uint8Array(signature);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) throw new Error("Signature ECDSA invalide.");

  let offset = 2;
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f);
  if (bytes[offset++] !== 0x02) throw new Error("Signature ECDSA invalide.");
  const rLength = bytes[offset++];
  let r = bytes.slice(offset, offset + rLength);
  offset += rLength;
  if (bytes[offset++] !== 0x02) throw new Error("Signature ECDSA invalide.");
  const sLength = bytes[offset++];
  let s = bytes.slice(offset, offset + sLength);

  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);

  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

async function createVapidJwt(endpoint, subject, publicKey, privateKey) {
  const publicBytes = base64UrlToBytes(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error("VAPID_PUBLIC_KEY est invalide.");
  }

  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: privateKey,
      ext: true,
      key_ops: ["sign"]
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: now + 12 * 60 * 60,
    sub: subject
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsigned)
  );
  return `${unsigned}.${bytesToBase64Url(normalizeEcdsaSignature(signature))}`;
}

async function encryptPayload(payload, subscriberPublicKey, authSecret) {
  const userPublicBytes = base64UrlToBytes(subscriberPublicKey);
  const authBytes = base64UrlToBytes(authSecret);

  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userPublicKey },
      serverKeys.privateKey,
      256
    )
  );

  const serverPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  const authPrk = await hkdfExtract(authBytes, sharedSecret);
  const keyInfo = concatBytes(
    encoder.encode("WebPush: info\0"),
    userPublicBytes,
    serverPublicBytes
  );
  const inputKeyMaterial = await hkdfExpand(authPrk, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltPrk = await hkdfExtract(salt, inputKeyMaterial);
  const contentEncryptionKey = await hkdfExpand(
    saltPrk,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdfExpand(
    saltPrk,
    encoder.encode("Content-Encoding: nonce\0"),
    12
  );

  const plaintext = concatBytes(encoder.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      aesKey,
      plaintext
    )
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([serverPublicBytes.length]),
    serverPublicBytes,
    encrypted
  );
}

export async function sendWebPush(environment, subscription, notification) {
  const publicKey = String(environment.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(environment.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(environment.VAPID_SUBJECT || "").trim();

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Configuration VAPID incomplète.");
  }

  const endpoint = String(subscription.endpoint || "");
  const jwt = await createVapidJwt(endpoint, subject, publicKey, privateKey);
  const body = await encryptPayload(
    JSON.stringify(notification),
    subscription.p256dh,
    subscription.auth
  );

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": notification.urgent ? "high" : "normal"
    },
    body
  });
}

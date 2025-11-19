/**
 * Web Crypto API encryption utilities for offline storage
 * Uses AES-GCM for authenticated encryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Derives an encryption key from user ID using PBKDF2
 */
async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('trade-marketing-offline'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random initialization vector
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts data using user-specific key
 */
export async function encryptData(data: string, userId: string): Promise<string> {
  try {
    const key = await deriveKey(userId);
    const iv = generateIV();
    const encoder = new TextEncoder();
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data using user-specific key
 */
export async function decryptData(encryptedData: string, userId: string): Promise<string> {
  try {
    const key = await deriveKey(userId);
    const combined = base64ToArrayBuffer(encryptedData);
    
    // Extract IV and encrypted data
    const iv = new Uint8Array(combined.slice(0, IV_LENGTH));
    const data = new Uint8Array(combined.slice(IV_LENGTH));

    const decryptedData = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypts a File object for offline storage
 */
export async function encryptFile(file: File, userId: string): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const metadata = JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      data: base64
    });
    return encryptData(metadata, userId);
  } catch (error) {
    console.error('File encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * Decrypts an encrypted file back to File object
 */
export async function decryptFile(encryptedFile: string, userId: string): Promise<File> {
  try {
    const metadataStr = await decryptData(encryptedFile, userId);
    const metadata = JSON.parse(metadataStr);
    
    const arrayBuffer = base64ToArrayBuffer(metadata.data);
    const blob = new Blob([arrayBuffer], { type: metadata.type });
    
    return new File([blob], metadata.name, {
      type: metadata.type,
      lastModified: metadata.lastModified
    });
  } catch (error) {
    console.error('File decryption error:', error);
    throw new Error('Failed to decrypt file');
  }
}

/**
 * Clears all encryption keys from memory (called on logout)
 */
export function clearEncryptionKeys() {
  // Keys are not stored in memory, they're derived on-demand
  // This is a placeholder for future enhancements
  console.log('Encryption keys cleared');
}

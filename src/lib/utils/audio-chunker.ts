/**
 * Client-side audio chunker.
 * Downloads an audio file and splits it into smaller blobs,
 * then base64-encodes each chunk for sending to edge functions.
 */

const CHUNK_SIZE_BYTES = 4 * 1024 * 1024; // ~4MB per chunk — fewer chunks, avoids invalid container fragments

export interface AudioChunk {
  base64: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads an audio file from a URL and splits it into base64-encoded chunks.
 * Each chunk is ~2.5MB of raw audio bytes (~3.3MB base64).
 */
export async function chunkAudioFromUrl(audioUrl: string): Promise<AudioChunk[]> {
  // Download the full audio blob in the browser
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Erro ao baixar áudio: ${response.status}`);

  const blob = await response.blob();
  const mimeType = blob.type || "audio/webm";
  const totalBytes = blob.size;

  console.log(`[audio-chunker] Total size: ${(totalBytes / 1024 / 1024).toFixed(1)}MB, type: ${mimeType}`);

  // If small enough, send as single chunk
  if (totalBytes <= CHUNK_SIZE_BYTES * 1.2) {
    const base64 = await blobToBase64(blob);
    return [{ base64, mimeType, chunkIndex: 0, totalChunks: 1 }];
  }

  // Split into byte-range chunks
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE_BYTES);
  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes);
    const slice = blob.slice(start, end, mimeType);
    const base64 = await blobToBase64(slice);
    chunks.push({ base64, mimeType, chunkIndex: i, totalChunks });
  }

  console.log(`[audio-chunker] Split into ${chunks.length} chunks`);
  return chunks;
}

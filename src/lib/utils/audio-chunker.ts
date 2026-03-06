/**
 * Client-side audio chunker.
 * Downloads an audio file and splits it into temporal chunks (~4 minutes each)
 * using the Web Audio API, then re-encodes as WAV and base64-encodes for sending.
 */

const CHUNK_DURATION_SECONDS = 240; // 4 minutes per chunk

export interface AudioChunk {
  base64: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  startSeconds: number;
  endSeconds: number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Encode a mono Float32Array as a WAV Blob at given sample rate.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  // Convert float32 to int16
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataBytes = int16.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataBytes, true);

  // Write PCM data
  const output = new Uint8Array(buffer);
  output.set(new Uint8Array(int16.buffer), 44);

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Mix multi-channel AudioBuffer down to a mono Float32Array.
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  const numChannels = audioBuffer.numberOfChannels;

  if (numChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
    return mono;
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += chData[i] / numChannels;
    }
  }
  return mono;
}

/**
 * Downloads an audio file from a URL and splits it into temporal chunks (~4 min each).
 * Each chunk is re-encoded as mono WAV (original sample rate) → base64.
 */
export async function chunkAudioFromUrl(audioUrl: string): Promise<AudioChunk[]> {
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Erro ao baixar áudio: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const totalMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`[audio-chunker] Downloaded ${totalMB}MB, decoding...`);

  // Decode using Web Audio API
  const audioCtx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;
  console.log(`[audio-chunker] Decoded: ${totalDuration.toFixed(1)}s, ${sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

  // Mix down to mono (simple array copy, no OfflineAudioContext needed)
  const monoSamples = mixToMono(audioBuffer);
  const totalSamples = monoSamples.length;
  const samplesPerChunk = sampleRate * CHUNK_DURATION_SECONDS;

  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);
  console.log(`[audio-chunker] Splitting into ${totalChunks} chunks of ~${CHUNK_DURATION_SECONDS}s each`);

  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSample = i * samplesPerChunk;
    const endSample = Math.min(startSample + samplesPerChunk, totalSamples);

    const startSeconds = startSample / sampleRate;
    const endSeconds = endSample / sampleRate;

    // Slice the mono samples for this chunk
    const chunkSamples = monoSamples.subarray(startSample, endSample);

    // Encode as WAV
    const wavBlob = encodeWav(chunkSamples, sampleRate);
    const base64 = await blobToBase64(wavBlob);

    const wavMB = (wavBlob.size / 1024 / 1024).toFixed(1);
    console.log(`[audio-chunker] Chunk ${i + 1}/${totalChunks}: ${startSeconds.toFixed(0)}s-${endSeconds.toFixed(0)}s (${wavMB}MB WAV)`);

    chunks.push({
      base64,
      mimeType: "audio/wav",
      chunkIndex: i,
      totalChunks,
      startSeconds,
      endSeconds,
    });
  }

  return chunks;
}

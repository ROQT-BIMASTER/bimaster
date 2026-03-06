/**
 * Client-side audio chunker.
 * Downloads an audio file and splits it into temporal chunks (~4 minutes each)
 * using the Web Audio API, then re-encodes as WAV and base64-encodes for sending.
 */

const CHUNK_DURATION_SECONDS = 240; // 4 minutes per chunk
const TARGET_SAMPLE_RATE = 16000; // 16kHz mono — keeps WAV size manageable

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
 * Encode an AudioBuffer (mono, any sample rate) into a WAV Blob.
 */
function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1; // force mono
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const numSamples = channelData.length;

  // Convert float32 to int16
  const int16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataBytes = int16.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataBytes, true);

  // Write PCM data
  const output = new Uint8Array(buffer);
  output.set(new Uint8Array(int16.buffer), 44);

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Downsample an AudioBuffer to a target sample rate using OfflineAudioContext.
 */
async function downsampleBuffer(
  audioBuffer: AudioBuffer,
  targetRate: number
): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate <= targetRate) return audioBuffer;

  const duration = audioBuffer.duration;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * targetRate), targetRate);
  const source = offlineCtx.createBufferSource();

  // Mix down to mono if needed
  if (audioBuffer.numberOfChannels > 1) {
    const monoBuffer = offlineCtx.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
    const monoData = monoBuffer.getChannelData(0);
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < audioBuffer.length; i++) {
        monoData[i] += chData[i] / audioBuffer.numberOfChannels;
      }
    }
    source.buffer = monoBuffer;
  } else {
    source.buffer = audioBuffer;
  }

  source.connect(offlineCtx.destination);
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * Downloads an audio file from a URL and splits it into temporal chunks (~4 min each).
 * Each chunk is re-encoded as mono 16kHz WAV → base64.
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

  const totalDuration = audioBuffer.duration;
  console.log(`[audio-chunker] Decoded: ${totalDuration.toFixed(1)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

  // Downsample to 16kHz mono for smaller WAV chunks
  const downsampled = await downsampleBuffer(audioBuffer, TARGET_SAMPLE_RATE);
  const sampleRate = downsampled.sampleRate;
  const totalSamples = downsampled.length;
  const samplesPerChunk = sampleRate * CHUNK_DURATION_SECONDS;

  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);
  console.log(`[audio-chunker] Splitting into ${totalChunks} chunks of ~${CHUNK_DURATION_SECONDS}s each`);

  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSample = i * samplesPerChunk;
    const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
    const chunkLength = endSample - startSample;

    const startSeconds = startSample / sampleRate;
    const endSeconds = endSample / sampleRate;

    // Create a new buffer for this chunk
    const offlineCtx = new OfflineAudioContext(1, chunkLength, sampleRate);
    const chunkBuffer = offlineCtx.createBuffer(1, chunkLength, sampleRate);
    const srcData = downsampled.getChannelData(0);
    const dstData = chunkBuffer.getChannelData(0);
    for (let j = 0; j < chunkLength; j++) {
      dstData[j] = srcData[startSample + j];
    }

    // Encode as WAV
    const wavBlob = encodeWav(chunkBuffer);
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

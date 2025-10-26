// Classe para gerenciar WebSocket e áudio da ligação com OpenAI Realtime API

export interface CallMessage {
  role: 'ai' | 'prospect';
  content: string;
  timestamp: number;
}

export interface CallAction {
  type: string;
  data: any;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      console.log('Iniciando gravação de áudio...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('Gravação de áudio iniciada com sucesso');
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      throw error;
    }
  }

  stop() {
    console.log('Parando gravação de áudio...');
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('Gravação de áudio parada');
  }
}

// Codifica Float32Array em base64 PCM16
export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
};

// Cria WAV a partir de PCM
const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + int16Data.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, int16Data.byteLength, true);

  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
  wavArray.set(new Uint8Array(wavHeader), 0);
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);

  return wavArray;
};

// Fila de áudio para reprodução sequencial
class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      const wavData = createWavFromPCM(audioData);
      // Cast explícito para ArrayBuffer
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer as ArrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      source.onended = () => this.playNext();
      source.start(0);
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
  }
}

export class RealtimeAudioCall {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioQueue | null = null;
  private callStartTime: number = 0;
  private transcript: string = '';
  private actions: CallAction[] = [];
  private currentFunctionCall: { name: string; arguments: string } | null = null;

  constructor(
    private onMessage: (message: CallMessage) => void,
    private onStatusChange: (status: string) => void,
    private onAISpeaking: (speaking: boolean) => void
  ) {}

  async startCall(callId: string, clientSecret: string): Promise<void> {
    try {
      console.log('Iniciando ligação...', callId);
      this.onStatusChange('connecting');

      // Inicializar contexto de áudio
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.audioQueue = new AudioQueue(this.audioContext);

      // Conectar ao WebSocket OpenAI
      this.ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`,
        ['realtime', `openai-insecure-api-key.${clientSecret}`]
      );

      this.callStartTime = Date.now();

      this.ws.onopen = () => {
        console.log('WebSocket conectado');
        this.onStatusChange('connected');
      };

      this.ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Evento recebido:', data.type, data);

        await this.handleWebSocketMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        this.onStatusChange('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket desconectado');
        this.onStatusChange('disconnected');
      };

      // Iniciar gravação do microfone
      this.recorder = new AudioRecorder((audioData) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const encoded = encodeAudioForAPI(audioData);
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encoded
          }));
        }
      });

      await this.recorder.start();
      console.log('Ligação iniciada com sucesso');

    } catch (error) {
      console.error('Erro ao iniciar ligação:', error);
      this.onStatusChange('error');
      throw error;
    }
  }

  private async handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'session.created':
        console.log('Sessão criada com sucesso');
        break;

      case 'response.audio.delta':
        // Reproduzir áudio da IA
        const binaryString = atob(data.delta);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await this.audioQueue?.addToQueue(bytes);
        break;

      case 'response.audio_transcript.delta':
        // Transcrição da fala da IA
        this.transcript += data.delta;
        this.onMessage({
          role: 'ai',
          content: data.delta,
          timestamp: Date.now() - this.callStartTime
        });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Transcrição da fala do usuário
        this.onMessage({
          role: 'prospect',
          content: data.transcript,
          timestamp: Date.now() - this.callStartTime
        });
        break;

      case 'response.created':
        this.onAISpeaking(true);
        break;

      case 'response.done':
        this.onAISpeaking(false);
        break;

      case 'response.function_call_arguments.delta':
        // Acumular argumentos de function call
        if (!this.currentFunctionCall) {
          this.currentFunctionCall = {
            name: data.name || '',
            arguments: ''
          };
        }
        this.currentFunctionCall.arguments += data.delta;
        break;

      case 'response.function_call_arguments.done':
        // Function call completo
        if (data.arguments) {
          try {
            const args = JSON.parse(data.arguments);
            this.actions.push({
              type: data.name,
              data: args
            });
            console.log('Ação registrada:', data.name, args);

            // Enviar resposta da função
            this.ws?.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: data.call_id,
                output: JSON.stringify({ success: true })
              }
            }));
          } catch (error) {
            console.error('Erro ao processar function call:', error);
          }
        }
        this.currentFunctionCall = null;
        break;

      case 'error':
        console.error('Erro da API:', data);
        break;
    }
  }

  endCall(): { duration: number; transcript: string; actions: CallAction[] } {
    console.log('Encerrando ligação...');
    
    this.recorder?.stop();
    this.audioQueue?.clear();
    this.ws?.close();
    
    const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
    
    return {
      duration,
      transcript: this.transcript,
      actions: this.actions
    };
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SttTranscriptionResponse {
  text: string;
  language?: string;
  recognizer_language?: string;
  task?: string;
  engine?: string;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SpeechToTextService {
  private readonly STT_API_URL = 'http://127.0.0.1:5002/stt/transcribe';

  private recognition: SpeechRecognitionLike | null = null;

  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private recordedSampleRate = 16000;
  private recordingWithBackend = false;
  private recordingLanguage = 'fr-FR';

  private readonly listeningSubject = new BehaviorSubject<boolean>(false);
  private readonly interimTextSubject = new BehaviorSubject<string>('');
  private readonly finalTranscriptSubject = new Subject<string>();
  private readonly errorSubject = new Subject<string>();

  constructor(private readonly http: HttpClient) {}

  listeningChanges(): Observable<boolean> {
    return this.listeningSubject.asObservable();
  }

  interimTextChanges(): Observable<string> {
    return this.interimTextSubject.asObservable();
  }

  finalTranscriptChanges(): Observable<string> {
    return this.finalTranscriptSubject.asObservable();
  }

  errors(): Observable<string> {
    return this.errorSubject.asObservable();
  }

  isSupported(): boolean {
    return this.canRecordWavFromMic() || !!this.getRecognitionCtor();
  }

  start(language: string): boolean {
    if (this.listeningSubject.value) {
      return true;
    }

    if (this.canRecordWavFromMic()) {
      this.startBackendRecording(language);
      return true;
    }

    if (!this.getRecognitionCtor()) {
      this.errorSubject.next(
        'Reconnaissance vocale non supportee par ce navigateur.',
      );
      return false;
    }

    const recognition = this.createRecognition(language);
    if (!recognition) {
      this.errorSubject.next(
        'Impossible de demarrer la reconnaissance vocale.',
      );
      return false;
    }

    this.recognition = recognition;

    try {
      recognition.start();
      return true;
    } catch (error) {
      console.error('[STT] Erreur demarrage:', error);
      this.listeningSubject.next(false);
      this.interimTextSubject.next('');
      this.recognition = null;
      this.errorSubject.next('Echec du demarrage du micro.');
      return false;
    }
  }

  stop(): void {
    if (this.recordingWithBackend) {
      this.stopBackendRecordingAndTranscribe();
      return;
    }

    if (!this.recognition) {
      return;
    }

    this.recognition.stop();
  }

  abort(): void {
    if (this.recordingWithBackend) {
      this.cleanupBackendRecording();
      this.recordingWithBackend = false;
      this.listeningSubject.next(false);
      this.interimTextSubject.next('');
    }

    if (!this.recognition) {
      return;
    }

    this.recognition.abort();
    this.listeningSubject.next(false);
    this.interimTextSubject.next('');
    this.recognition = null;
  }

  private createRecognition(language: string): SpeechRecognitionLike | null {
    const ctor = this.getRecognitionCtor();
    if (!ctor) {
      return null;
    }

    const recognition = new ctor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.listeningSubject.next(true);
    };

    recognition.onresult = (event) => {
      this.handleResult(event as SpeechRecognitionEventLike);
    };

    recognition.onerror = (event) => {
      const errorEvent = event as SpeechRecognitionErrorEventLike;
      const message = this.mapError(errorEvent.error);
      this.errorSubject.next(message);
    };

    recognition.onend = () => {
      this.listeningSubject.next(false);
      this.interimTextSubject.next('');
      this.recognition = null;
    };

    return recognition;
  }

  private handleResult(event: SpeechRecognitionEventLike): void {
    const interimParts: string[] = [];
    const finalParts: string[] = [];

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result?.[0]?.transcript?.trim() || '';
      if (!transcript) {
        continue;
      }

      if (result.isFinal) {
        finalParts.push(transcript);
      } else {
        interimParts.push(transcript);
      }
    }

    this.interimTextSubject.next(interimParts.join(' ').trim());

    const finalText = finalParts.join(' ').trim();
    if (finalText) {
      this.finalTranscriptSubject.next(finalText);
    }
  }

  private getRecognitionCtor(): SpeechRecognitionCtor | null {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  private canRecordWavFromMic(): boolean {
    const hasNavigator = typeof navigator !== 'undefined';
    const hasMediaDevices =
      hasNavigator &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function';
    const hasAudioContext = !!(
      window.AudioContext || (window as any).webkitAudioContext
    );

    return hasMediaDevices && hasAudioContext;
  }

  private startBackendRecording(language: string): void {
    this.recordingLanguage = language;
    this.recordedChunks = [];

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      .then((stream) => {
        const AudioContextCtor =
          window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextCtor();
        this.mediaStream = stream;
        this.recordedSampleRate = this.audioContext.sampleRate;

        this.mediaSource = this.audioContext.createMediaStreamSource(stream);
        this.scriptProcessor = this.audioContext.createScriptProcessor(
          4096,
          1,
          1,
        );

        this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
          const input = event.inputBuffer.getChannelData(0);
          this.recordedChunks.push(new Float32Array(input));
        };

        this.mediaSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);

        this.recordingWithBackend = true;
        this.listeningSubject.next(true);
        this.interimTextSubject.next('Enregistrement vocal en cours...');
      })
      .catch((error) => {
        console.error(
          '[STT][API] Echec micro backend, fallback navigateur',
          error,
        );
        this.cleanupBackendRecording();
        this.startBrowserFallback(this.recordingLanguage);
      });
  }

  private stopBackendRecordingAndTranscribe(): void {
    this.recordingWithBackend = false;
    this.listeningSubject.next(false);
    this.interimTextSubject.next('Transcription en cours...');

    const samples = this.concatFloat32(this.recordedChunks);
    const sampleRate = this.recordedSampleRate;

    this.cleanupBackendRecording();

    if (!samples.length) {
      this.interimTextSubject.next('');
      this.errorSubject.next('Aucun audio detecte.');
      return;
    }

    const wavBlob = this.encodeWav(samples, sampleRate);
    const formData = new FormData();
    formData.append('audio', wavBlob, 'chat-message.wav');
    formData.append(
      'language',
      this.mapLocaleToLanguage(this.recordingLanguage),
    );
    formData.append('sample_rate', String(sampleRate));

    this.http
      .post<SttTranscriptionResponse>(this.STT_API_URL, formData)
      .subscribe({
        next: (response) => {
          console.log('[STT][API] Response:', {
            language: response?.language,
            recognizerLanguage: response?.recognizer_language,
            task: response?.task,
            engine: response?.engine,
          });
          this.interimTextSubject.next('');
          const text = String(response?.text || '').trim();
          if (text) {
            this.finalTranscriptSubject.next(text);
          } else {
            this.errorSubject.next('Aucune parole reconnue.');
          }
        },
        error: (error) => {
          console.error('[STT][API] Erreur transcription:', error);
          this.interimTextSubject.next('');
          this.errorSubject.next(
            'API STT indisponible. Fallback navigateur recommande.',
          );
        },
      });
  }

  private startBrowserFallback(language: string): void {
    const recognition = this.createRecognition(language);

    if (!recognition) {
      this.errorSubject.next(
        'Impossible de demarrer la reconnaissance vocale.',
      );
      return;
    }

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      console.error('[STT][FB] Erreur demarrage fallback:', error);
      this.listeningSubject.next(false);
      this.interimTextSubject.next('');
      this.recognition = null;
      this.errorSubject.next('Echec du demarrage du micro.');
    }
  }

  private cleanupBackendRecording(): void {
    this.scriptProcessor?.disconnect();
    this.mediaSource?.disconnect();
    this.scriptProcessor = null;
    this.mediaSource = null;

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  private concatFloat32(chunks: Float32Array[]): Float32Array {
    if (!chunks.length) {
      return new Float32Array(0);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  private encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    this.writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    this.writeAscii(view, 8, 'WAVE');
    this.writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    this.writeAscii(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeAscii(view: DataView, offset: number, text: string): void {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  }

  private mapLocaleToLanguage(locale: string): string {
    const lower = String(locale || '').toLowerCase();

    if (lower.startsWith('ar')) {
      return 'ar';
    }

    if (lower.startsWith('en')) {
      return 'en';
    }

    return 'fr';
  }

  private mapError(errorCode: string): string {
    switch (errorCode) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Acces micro refuse. Autorisez le micro dans le navigateur.';
      case 'no-speech':
        return 'Aucune voix detectee. Reessayez.';
      case 'audio-capture':
        return 'Aucun micro detecte sur cet appareil.';
      case 'network':
        return 'Erreur reseau pendant la reconnaissance vocale.';
      case 'aborted':
        return 'Reconnaissance vocale interrompue.';
      default:
        return 'Erreur reconnaissance vocale.';
    }
  }
}

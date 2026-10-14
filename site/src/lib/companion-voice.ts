/** Browser-only voice resources, kept out of Qwik's serialized component state. */
export type VoicePhase = 'idle' | 'requesting' | 'listening' | 'transcribing' | 'preparing' | 'speaking' | 'paused';
export interface VoiceEvents {
  phase: (phase: VoicePhase) => void;
  error: (message: string) => void;
  transcript: (text: string, truncated: boolean) => void;
  level: (level: number) => void;
  seconds: (seconds: number) => void;
}

export class CompanionVoice {
  private generation = 0;
  private phase: VoicePhase = 'idle';
  private request?: AbortController;
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private audioUrl?: string;
  private context?: AudioContext;
  private source?: AudioNode;
  private meterFrame = 0;
  private timer?: ReturnType<typeof setInterval>;
  private csrf?: string;

  constructor(private api: string, private events: VoiceEvents, private requiresAccount = false) {}

  private setPhase(phase: VoicePhase) { this.phase = phase; this.events.phase(phase); }
  private clearMeter() {
    cancelAnimationFrame(this.meterFrame);
    this.source?.disconnect(); this.source = undefined;
    this.events.level(0);
  }
  private meter(source: AudioNode) {
    this.clearMeter(); this.source = source;
    const analyser = this.context!.createAnalyser(); analyser.fftSize = 256;
    source.connect(analyser);
    const values = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(values);
      let sum = 0;
      for (const value of values) sum += ((value - 128) / 128) ** 2;
      const audible = this.phase === 'listening' || (this.phase === 'speaking' && !!this.audio && !this.audio.muted && this.audio.volume > 0);
      this.events.level(audible ? Math.min(1, Math.sqrt(sum / values.length) * 6) : 0);
      this.meterFrame = requestAnimationFrame(tick);
    };
    tick();
  }
  /** Called from a gesture. Audio playback still handles browsers that require another tap. */
  unlock() {
    if (!this.context && typeof AudioContext !== 'undefined') this.context = new AudioContext();
    void this.context?.resume().catch(() => {});
  }
  private stopMicrophone() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.clearMeter();
  }
  stop() {
    this.generation++;
    this.request?.abort(); this.request = undefined;
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = undefined;
    this.stopMicrophone();
    if (this.audio) {
      this.audio.onplaying = this.audio.onpause = this.audio.onended = this.audio.onerror = this.audio.onwaiting = null;
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = undefined;
    }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = undefined;
    this.events.seconds(0); this.setPhase('idle');
  }
  dispose() { this.stop(); void this.context?.close().catch(() => {}); this.context = undefined; }
  private async headers(signal: AbortSignal): Promise<Record<string, string>> {
    if (this.requiresAccount && !this.csrf) {
      const response = await fetch(`${this.api}/notorganic/status`, { credentials: 'same-origin', signal });
      const data = response.ok ? await response.json() : null;
      if (!data?.authenticated) throw new Error('Sign in through the Studio to use voice. You can still type here.');
      this.csrf = data.csrfToken;
    }
    return this.csrf ? { 'X-Baste-CSRF': this.csrf } : {};
  }
  private async checked(response: Response) {
    if (response.ok) return response;
    const body = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) this.csrf = undefined;
    throw new Error(typeof body?.error === 'string' ? body.error : 'Voice didn’t connect. Try again, or keep typing.');
  }

  async listen() {
    this.stop(); this.unlock(); this.events.error('');
    const run = this.generation;
    this.setPhase('requesting');
    try {
      const request = this.request = new AbortController();
      await this.headers(AbortSignal.any([request.signal, AbortSignal.timeout(15000)]));
      if (run !== this.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (run !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser cannot record a supported audio format. You can still type.');
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      this.recorder = recorder;
      const chunks: Blob[] = []; let size = 0;
      recorder.ondataavailable = event => {
        if (run !== this.generation || !event.data.size) return;
        chunks.push(event.data); size += event.data.size;
        if (size > 900000) this.finishListening();
      };
      recorder.onerror = () => { if (run === this.generation) { this.stop(); this.events.error('The microphone stopped. Please try again.'); } };
      recorder.onstop = () => {
        if (run !== this.generation) return;
        this.stopMicrophone(); this.recorder = undefined;
        if (!size) { this.setPhase('idle'); this.events.error('No audio was recorded. Try again, or type your message.'); return; }
        void this.transcribe(new Blob(chunks, { type: mimeType.split(';')[0] }), run);
      };
      recorder.start(250); this.setPhase('listening');
      const start = performance.now();
      this.timer = setInterval(() => {
        const elapsed = Math.floor((performance.now() - start) / 1000);
        this.events.seconds(elapsed);
        if (elapsed >= 45) this.finishListening();
      }, 250);
      if (this.context) this.meter(this.context.createMediaStreamSource(stream));
    } catch (error) {
      if (run !== this.generation) return;
      this.stop();
      const name = (error as Error).name;
      this.events.error(name === 'NotAllowedError' ? 'Microphone access is off. Allow it in your browser, or keep typing.' : name === 'NotFoundError' ? 'No microphone was found. You can still type.' : error instanceof Error ? error.message : 'The microphone could not start.');
    }
  }
  finishListening() {
    if (this.recorder?.state === 'recording') { this.setPhase('transcribing'); this.recorder.stop(); this.stopMicrophone(); }
  }
  private async transcribe(blob: Blob, run: number) {
    this.setPhase('transcribing');
    const request = this.request = new AbortController();
    try {
      const headers = await this.headers(request.signal);
      const response = await this.checked(await fetch(`${this.api}/voice/transcribe`, {
        method: 'POST', credentials: 'same-origin', headers: { ...headers, 'Content-Type': blob.type }, body: blob,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      }));
      const data = await response.json();
      if (run !== this.generation) return;
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('I couldn’t hear words in that recording. Try again, or type your message.');
      this.events.transcript(data.text, !!data.truncated); this.setPhase('idle');
    } catch (error) {
      if (run === this.generation) { this.setPhase('idle'); this.events.error(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Transcription took too long. Try a shorter recording, or type your message.'); }
    }
  }

  async speak(id: string, text: string) {
    this.stop(); this.unlock(); this.events.error('');
    const run = this.generation;
    const request = this.request = new AbortController();
    this.setPhase('preparing');
    try {
      const headers = await this.headers(request.signal);
      const response = await this.checked(await fetch(`${this.api}/voice/speak/${encodeURIComponent(id)}`, {
        method: 'POST', credentials: 'same-origin', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 1600) }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
      }));
      const blob = await response.blob();
      if (run !== this.generation) return;
      const audio = this.audio = new Audio();
      this.audioUrl = URL.createObjectURL(blob); audio.src = this.audioUrl;
      audio.onplaying = () => { if (run === this.generation) this.setPhase('speaking'); };
      audio.onpause = () => { if (run === this.generation && !audio.ended) { this.events.level(0); this.setPhase('paused'); } };
      audio.onwaiting = () => { if (run === this.generation && !audio.paused) this.setPhase('preparing'); };
      audio.onended = () => { if (run === this.generation) this.stop(); };
      audio.onerror = () => { if (run === this.generation) { this.stop(); this.events.error('That audio could not play. The written reply is still here.'); } };
      if (this.context) {
        const source = this.context.createMediaElementSource(audio);
        this.meter(source); source.connect(this.context.destination);
      }
      await audio.play().catch(() => { if (run === this.generation) this.setPhase('paused'); });
    } catch (error) {
      if (run === this.generation) { this.stop(); this.events.error(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The voice took too long. Try again, or read the reply here.'); }
    }
  }
  pause() { this.audio?.pause(); }
  async resume() {
    this.unlock();
    try { await this.audio?.play(); }
    catch { this.events.error('Playback is blocked. Check this tab’s audio permissions and try again.'); }
  }
}

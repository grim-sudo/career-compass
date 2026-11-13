import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { ArrowLeft, ArrowUp, Microphone, Stop, Sun, Moon, SpeakerHigh, ChatCircleText } from '@phosphor-icons/react';
import { useTheme } from '../contexts/ThemeContext';
import { API_ENDPOINTS } from '../config/api';
import { createJoeMouth, sampleJoeMouth } from './joeLipSync';
import '../styles/TeacherJoeAvatar.css';

function TeacherJoeModel({ speechRef, isSpeaking, animateMouth }) {
  const { scene } = useGLTF('/models/teacher-joe.glb');
  const mouth = useMemo(() => createJoeMouth(scene), [scene]);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => () => mouth.dispose(), [mouth]);
  useEffect(() => { invalidate(); }, [isSpeaking, animateMouth, invalidate]);
  useFrame(() => {
    mouth.setOpening(animateMouth ? sampleJoeMouth(speechRef.current, performance.now() / 1000) : 0);
    if (animateMouth && speechRef.current.active) invalidate();
  });
  // Measured GLB: height .518, eyes at y .209, face toward +Z. Crop at chest level, not full-body bounds.
  return <group scale={1 / .518} position={[0, -.183 / .518 - .002, -.25 / .518]}><primitive object={mouth.scene} dispose={null} /></group>;
}

// Browser voices have no gender field; only prefer known male voice names, never guess by pitch.
export const isKnownMaleVoice = voice => /\b(male|david|mark|guy|james|daniel|george|ryan|alex|fred|thomas|oliver)\b/i.test(voice.name);
export const preferredJoeVoice = voices => voices.find(isKnownMaleVoice) || voices.find(voice => voice.default) || voices[0];

class AvatarBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="avatar-fallback" role="status">The 3D preview couldn't load. You can still use the voice controls.</div> : this.props.children; }
}

export default function TeacherJoeAvatar({ onToggleView }) {
  const [listening, setListening] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState('');
  const [playback, setPlayback] = useState('idle');
  const isSpeaking = playback === 'speaking';
  const hasPlayback = playback !== 'idle';
  const [animateMouth, setAnimateMouth] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const speechRef = useRef({ active: false, cueAt: 0, cueDuration: .28 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState('');
  const voiceChosenRef = useRef(false);
  const selectedVoice = voices.find(voice => voice.voiceURI === voiceURI) || preferredJoeVoice(voices);
  const busyRef = useRef(false);
  const utteranceRef = useRef(null);
  const recognitionRef = useRef(null);
  const requestRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const status = listening ? 'Listening to you' : isProcessing ? 'Thinking it through' : isSpeaking ? 'Teacher Joe is speaking' : playback === 'queued' ? 'Preparing Joe’s voice' : playback === 'paused' ? 'Voice playback paused' : 'Ready when you are';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimateMouth(!media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis?.getVoices) return;
    const updateVoices = () => {
      const available = synthesis.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
      setVoices(available);
      setVoiceURI(previous => voiceChosenRef.current && available.some(voice => voice.voiceURI === previous) ? previous : preferredJoeVoice(available)?.voiceURI || '');
    };
    updateVoices();
    synthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => synthesis.removeEventListener?.('voiceschanged', updateVoices);
  }, []);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.abort();
    }
    requestRef.current?.abort();
    speechRef.current.active = false;
    if (utteranceRef.current) for (const event of ['start', 'end', 'error', 'pause', 'resume', 'boundary']) utteranceRef.current[`on${event}`] = null;
    utteranceRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [conversation, interimSpeech]);

  const stopSpeaking = () => {
    speechRef.current.active = false;
    if (utteranceRef.current) for (const event of ['start', 'end', 'error', 'pause', 'resume', 'boundary']) utteranceRef.current[`on${event}`] = null;
    utteranceRef.current = null;
    window.speechSynthesis?.cancel();
    setPlayback('idle');
  };

  const speakPreview = (text) => {
    if (!window.speechSynthesis) { setError('This browser cannot play the voice preview. The reply is available in your transcript.'); return; }
    stopSpeaking();
    setError('');
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || 'en-US';
      utterance.rate = .95;
      const start = () => {
        if (utteranceRef.current !== utterance) return;
        speechRef.current = { active: true, cueAt: performance.now() / 1000, cueDuration: .28 };
        setPlayback('speaking');
      };
      utterance.onstart = utterance.onresume = start;
      utterance.onpause = () => {
        if (utteranceRef.current !== utterance) return;
        speechRef.current.active = false;
        setPlayback('paused');
      };
      utterance.onboundary = event => {
        if (utteranceRef.current !== utterance || !speechRef.current.active) return;
        const word = text.slice(event.charIndex).match(/^\S+/)?.[0] || '';
        speechRef.current.cueAt = performance.now() / 1000;
        speechRef.current.cueDuration = Math.min(.4, Math.max(.18, word.length * .045 / utterance.rate));
      };
      const finish = () => {
        if (utteranceRef.current !== utterance) return;
        speechRef.current.active = false;
        utteranceRef.current = null;
        setPlayback('idle');
      };
      utterance.onend = finish;
      utterance.onerror = event => { if (utteranceRef.current !== utterance) return; finish(); if (event.error !== 'canceled' && event.error !== 'interrupted') setError('Voice playback was unavailable. You can read the reply below.'); };
      setPlayback('queued');
      window.speechSynthesis.speak(utterance);
    } catch {
      stopSpeaking();
      setError('Voice playback was unavailable. You can read the reply below.');
    }
  };

  const sendTranscript = async (text) => {
    if (!text.trim() || busyRef.current) return;
    if (text.trim().length > 8000) { setError('Please keep each turn under 8,000 characters. Try a shorter question.'); return; }
    busyRef.current = true;
    setError('');
    const recent = [];
    let length = 0;
    for (const message of conversation.slice(-20).reverse()) {
      if (length + message.text.length > 48000) break;
      recent.unshift(message);
      length += message.text.length;
    }
    setConversation(previous => [...previous, { sender: 'user', text }]);
    setIsProcessing(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(API_ENDPOINTS.GEMINI, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, mode: 'teacher-joe', history: recent }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 32000) throw new Error('Reply unavailable');
      setConversation(previous => [...previous, { sender: 'bot', text: data.text }]);
      speakPreview(data.text);
    } catch (failure) {
      if (failure.name !== 'AbortError') setError('Unable to get a reply. Check your connection and assistant configuration, then try again.');
    } finally {
      busyRef.current = false;
      if (!controller.signal.aborted) setIsProcessing(false);
    }
  };

  const handleMicClick = () => {
    if (busyRef.current || listening) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError('Voice input is unavailable in this browser. Try Chrome or Edge, or return to Chat.'); return; }
    stopSpeaking();
    setError('');
    setInterimSpeech('');
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = '';
    let failed = false;
    recognition.onresult = event => {
      let interim = '';
      finalText = '';
      for (let index = 0; index < event.results.length; index++) {
        if (event.results[index].isFinal) finalText += event.results[index][0].transcript;
        else interim += event.results[index][0].transcript;
      }
      setInterimSpeech(finalText || interim);
    };
    recognition.onerror = event => {
      failed = true;
      setListening(false);
      setInterimSpeech('');
      setError(event.error === 'not-allowed' ? 'Microphone access was denied. Allow microphone access in your browser to try again.' : 'Voice input stopped. Please try again.');
    };
    recognition.onend = () => { recognition.onend = null; setListening(false); setInterimSpeech(''); if (!failed && finalText.trim()) sendTranscript(finalText); };
    try { recognition.start(); setListening(true); }
    catch { setError('Unable to start the microphone. Please try again.'); }
  };

  const handleTypedMessage = event => {
    event.preventDefault();
    if (!input.trim() || isProcessing || listening) return;
    stopSpeaking();
    sendTranscript(input.trim());
    setInput('');
  };

  return (
    <main className="teacher-joe-container screen-enter">
      <header className="joe-header"><button className="button button-quiet" onClick={() => onToggleView(false)}><ArrowLeft size={18} /> Back to Chat</button><div><span>ONE QUESTION AT A TIME</span><h1>A conversation with Joe</h1></div><button className="icon-button button-quiet" aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} onClick={toggleTheme}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button></header>
      <div className="joe-content">
        <section className="avatar-display" aria-label="Teacher Joe voice preview">
          <div className="studio-intro"><span className="studio-label">YOUR AI CAREER ADVISER</span><h2>Teacher Joe</h2><p>Let's talk about what's on your mind.</p></div>
          <div className="canvas-container" role="img" aria-label="Teacher Joe, shown face-to-face at eye level"><AvatarBoundary><Canvas camera={{ position: [0, 0, .54], fov: 25, near: .01, far: 8 }} frameloop="demand" dpr={[1, 1.5]} fallback={<div className="avatar-fallback">3D isn't supported here. Voice controls are still available.</div>}><ambientLight intensity={1.3} /><directionalLight position={[3, 4, 4]} intensity={2.2} /><directionalLight position={[-3, 2, 1]} intensity={.7} /><Suspense fallback={<Html center><span className="model-loading" role="status">Loading Teacher Joe...</span></Html>}><TeacherJoeModel speechRef={speechRef} isSpeaking={isSpeaking} animateMouth={animateMouth} /></Suspense></Canvas></AvatarBoundary></div>
          <div className="studio-status" role="status"><span className={`status-symbol ${listening || isSpeaking ? 'is-active' : ''}`}>{isSpeaking ? <SpeakerHigh size={18} /> : <Microphone size={18} />}</span>{status}</div>
          <div className="joe-controls"><button className="button button-primary" onClick={listening ? () => recognitionRef.current?.stop() : handleMicClick} disabled={isProcessing || hasPlayback}>{listening ? <Stop size={19} /> : <Microphone size={19} />}{listening ? 'Finish my turn' : 'Talk to Joe'}</button>{hasPlayback && <button className="button" onClick={stopSpeaking}><Stop size={18} /> Stop Speaking</button>}</div>
          <div className="joe-voice-picker"><label htmlFor="joe-voice">Joe's voice</label><select id="joe-voice" aria-label="Teacher Joe voice" value={selectedVoice?.voiceURI || ''} disabled={!voices.length || listening || hasPlayback || isProcessing} onChange={event => { voiceChosenRef.current = true; setVoiceURI(event.target.value); }}>{!voices.length && <option value="">Browser default</option>}{voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{isKnownMaleVoice(voice) ? ' · male' : ''}</option>)}</select><button className="button button-quiet" disabled={listening || isProcessing || hasPlayback || !window.speechSynthesis} onClick={() => speakPreview("Hi, I'm Teacher Joe, your AI career adviser. What do you enjoy learning?")}><SpeakerHigh size={16} /> Hear voice</button></div>
          <p className="voice-availability">{voices.some(isKnownMaleVoice) ? 'A known male voice is available. Choose the voice that feels right.' : 'No known male English voice was found. Voices depend on your browser and installed system voices; you can try Chrome or Edge.'}</p>
          {error && <p className="studio-error" role="alert">{error}</p>}
          <p className="studio-disclosure">AI adviser · browser speech · approximate lip-sync. Mouth movement follows playback and available word boundaries, not exact phonemes. Reduced motion keeps Joe still.</p>
        </section>
        <section className="conversation-panel" aria-labelledby="transcript-title"><div className="transcript-header"><h2 id="transcript-title">You & Joe</h2><span>English</span></div><div className="conversation-messages" role="log" aria-live="polite" aria-label="Voice transcript">{conversation.length === 0 && !interimSpeech ? <div className="transcript-empty"><ChatCircleText size={28} /><h3>“We don't need to figure<br />it all out at once.”</h3><p>Talk or type to begin. Tell Joe about a subject<br />you enjoy, or a choice you're finding difficult.</p></div> : conversation.map((message, index) => <article className={`studio-message ${message.sender} screen-enter`} key={index}><span>{message.sender === 'user' ? 'You' : 'Teacher Joe'}</span><p>{message.text}</p></article>)}{interimSpeech && <article className="studio-message interim"><span>You, speaking</span><p>{interimSpeech}</p></article>}{isProcessing && <p className="transcript-thinking" role="status">Thinking it through...</p>}<div ref={transcriptEndRef} /></div><form className="joe-text-form" onSubmit={handleTypedMessage}><input aria-label="Message Teacher Joe" placeholder="Or type your question to Joe…" value={input} maxLength={8000} disabled={isProcessing || listening} onChange={event => setInput(event.target.value)} /><button className="icon-button button-primary" type="submit" aria-label="Send to Teacher Joe" disabled={!input.trim() || isProcessing || listening}><ArrowUp size={20} /></button></form><div className="transcript-note">Joe remembers this conversation while you're here. It isn't saved when you leave.</div></section>
      </div>
    </main>
  );
}

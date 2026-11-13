import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TeacherJoeAvatar, { preferredJoeVoice } from './TeacherJoeAvatar';
import { ThemeProvider } from '../contexts/ThemeContext';
import { Canvas } from '@react-three/fiber';

jest.mock('@react-three/fiber', () => ({ Canvas: jest.fn(() => <div>3D test placeholder</div>), useFrame: jest.fn(), useThree: jest.fn() }));
jest.mock('@react-three/drei', () => ({ useGLTF: () => ({ scene: {} }), Html: ({ children }) => <div>{children}</div> }));
global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false });
Element.prototype.scrollIntoView = jest.fn();

test('voice preference falls back honestly when no known male voice is installed', () => {
  const unknown = { name: 'English voice', default: true };
  const other = { name: 'Another voice' };
  expect(preferredJoeVoice([other, unknown])).toBe(unknown);
  expect(preferredJoeVoice([other])).toBe(other);
  expect(preferredJoeVoice([])).toBeUndefined();
  const googleMale = { name: 'Google UK English Male' };
  expect(preferredJoeVoice([{ name: 'Google UK English Female', default: true }, googleMale])).toBe(googleMale);
});

test('voice input sends one finalized transcript, uses preview speech, and releases microphone/playback on exit', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const recognition = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
  window.SpeechRecognition = jest.fn(() => recognition);
  const female = { voiceURI: 'female', name: 'Microsoft Zira', lang: 'en-US', default: true };
  const male = { voiceURI: 'male', name: 'Microsoft David', lang: 'en-US' };
  let voices = [];
  let voicesChanged;
  window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn(), getVoices: () => voices, addEventListener: jest.fn((event, callback) => { voicesChanged = callback; }), removeEventListener: jest.fn() };
  global.SpeechSynthesisUtterance = function(text) { this.text = text; };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ text: 'Let us explore your interests.' }) }));
  try {
    await act(async () => root.render(<ThemeProvider><TeacherJoeAvatar onToggleView={() => {}} /></ThemeProvider>));
    voices = [female];
    await act(async () => voicesChanged());
    expect(host.querySelector('[aria-label="Teacher Joe voice"]').value).toBe('female');
    voices = [female, male];
    await act(async () => voicesChanged());
    expect(host.querySelector('[aria-label="Teacher Joe voice"]').value).toBe('male');
    await act(async () => host.querySelector('.joe-controls button').click());
    expect(host.querySelector('.studio-status').textContent).toMatch(/Listening/);
    await act(async () => {
      const result = [{ transcript: 'Help me choose a career.' }];
      result.isFinal = true;
      recognition.onresult({ results: [result] });
      recognition.onend();
    });
    expect(host.querySelectorAll('.studio-message.user')).toHaveLength(1);
    expect(host.querySelector('.studio-message.bot').textContent).toMatch(/explore your interests/);
    expect(window.speechSynthesis.speak.mock.calls[0][0].text).toMatch(/explore your interests/);
    expect(window.speechSynthesis.speak.mock.calls[0][0].voice).toBe(male);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ prompt: 'Help me choose a career.', mode: 'teacher-joe', history: [] });
    expect(host.querySelector('.joe-controls button').disabled).toBe(true);
    await act(async () => window.speechSynthesis.speak.mock.calls[0][0].onstart());
    await act(async () => window.speechSynthesis.speak.mock.calls[0][0].onend());
    await act(async () => {
      const input = host.querySelector('[aria-label="Message Teacher Joe"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'I like science.');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('.joe-text-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).history).toEqual([
      { sender: 'user', text: 'Help me choose a career.' }, { sender: 'bot', text: 'Let us explore your interests.' },
    ]);
    await act(async () => window.speechSynthesis.speak.mock.calls[1][0].onend());
    await act(async () => {
      const select = host.querySelector('[aria-label="Teacher Joe voice"]');
      select.value = 'female';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      voicesChanged();
    });
    expect(host.querySelector('[aria-label="Teacher Joe voice"]').value).toBe('female');
  } finally {
    await act(async () => root.unmount());
    expect(recognition.abort).toHaveBeenCalled();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.removeEventListener).toHaveBeenCalledWith('voiceschanged', voicesChanged);
    host.remove();
    delete window.SpeechRecognition;
    delete global.fetch;
  }
});

test('mouth follows actual speech lifecycle, not queued speech, and ignores interrupted callbacks', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn(), getVoices: () => [] };
  global.SpeechSynthesisUtterance = function(text) { this.text = text; };
  const speech = () => React.Children.toArray(Canvas.mock.calls.at(-1)[0].children)
    .find(child => child.type === React.Suspense).props.children.props.speechRef.current;
  const hear = () => host.querySelector('.joe-voice-picker button').click();
  const stop = () => host.querySelector('.joe-controls button:last-child').click();
  try {
    await act(async () => root.render(<ThemeProvider><TeacherJoeAvatar onToggleView={() => {}} /></ThemeProvider>));
    await act(async () => hear());
    const first = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    expect(speech().active).toBe(false);
    expect(host.querySelector('.studio-status').textContent).toMatch(/Preparing/);
    await act(async () => first.onstart());
    expect(speech().active).toBe(true);
    expect(host.querySelector('.studio-status').textContent).toMatch(/is speaking/);
    const before = speech().cueAt;
    await act(async () => first.onboundary({ name: 'word', charIndex: 8, charLength: 7 }));
    expect(speech().cueAt).toBeGreaterThanOrEqual(before);
    expect(speech().cueDuration).toBeGreaterThan(0);
    await act(async () => first.onpause());
    expect(speech().active).toBe(false);
    await act(async () => first.onresume());
    expect(speech().active).toBe(true);
    const lateStart = first.onstart, lateEnd = first.onend, lateBoundary = first.onboundary;
    await act(async () => stop());
    expect(speech().active).toBe(false);
    for (const event of ['start', 'end', 'error', 'pause', 'resume', 'boundary']) expect(first[`on${event}`]).toBeNull();
    await act(async () => hear());
    const second = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    await act(async () => { lateStart(); lateBoundary({ name: 'word', charIndex: 0 }); });
    expect(speech().active).toBe(false);
    await act(async () => second.onstart());
    await act(async () => lateEnd());
    expect(speech().active).toBe(true);
    await act(async () => second.onerror({ error: 'synthesis-failed' }));
    expect(speech().active).toBe(false);
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/playback was unavailable/);
    await act(async () => hear());
    const third = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    await act(async () => { third.onstart(); third.onend(); });
    expect(speech().active).toBe(false);
    await act(async () => hear());
    const fourth = window.speechSynthesis.speak.mock.calls.at(-1)[0];
    await act(async () => fourth.onstart());
    const state = speech();
    await act(async () => root.unmount());
    expect(state.active).toBe(false);
    expect(fourth.onboundary).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('a synchronous TTS failure releases queued speech controls', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  window.speechSynthesis = { cancel: jest.fn(), speak: () => { throw new Error('unavailable'); }, getVoices: () => [] };
  try {
    await act(async () => root.render(<ThemeProvider><TeacherJoeAvatar onToggleView={() => {}} /></ThemeProvider>));
    await act(async () => host.querySelector('.joe-voice-picker button').click());
    expect(host.querySelector('.studio-status').textContent).toMatch(/Ready/);
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/playback was unavailable/);
  } finally {
    await act(async () => root.unmount());
  }
});

test('reduced motion disables mouth animation without disabling speech', async () => {
  window.matchMedia = () => ({ matches: true });
  const host = document.createElement('div');
  const root = createRoot(host);
  window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn(), getVoices: () => [] };
  try {
    await act(async () => root.render(<ThemeProvider><TeacherJoeAvatar onToggleView={() => {}} /></ThemeProvider>));
    await act(async () => host.querySelector('.joe-voice-picker button').click());
    await act(async () => window.speechSynthesis.speak.mock.calls[0][0].onstart());
    const model = React.Children.toArray(Canvas.mock.calls.at(-1)[0].children)
      .find(child => child.type === React.Suspense).props.children;
    expect(model.props.animateMouth).toBe(false);
    expect(model.props.speechRef.current.active).toBe(true);
    expect(host.querySelector('.studio-status').textContent).toMatch(/is speaking/);
  } finally {
    await act(async () => root.unmount());
    window.matchMedia = () => ({ matches: false });
  }
});

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ChatInterface from './ChatInterface';
import { ThemeProvider } from '../contexts/ThemeContext';
import { loadHistory, saveHistory } from '../services/localApi';
import { translateText } from '../services/translateText';

jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }), { virtual: true });
jest.mock('../services/localApi', () => ({ getCurrentUser: () => ({ displayName: 'Student' }), logout: jest.fn(), loadHistory: jest.fn(async () => ({ conversations: [], revision: 0 })), saveHistory: jest.fn(async () => ({ revision: 1 })) }));
const mockI18n = { language: 'en', changeLanguage: jest.fn() };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => key, i18n: mockI18n }) }));
jest.mock('../services/translateText', () => ({ translateText: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false });
Element.prototype.scrollIntoView = jest.fn();

test('empty prompt fills the composer; pending reply blocks duplicate messages and failed HTTP shows a readable error', async () => {
  mockI18n.language = 'en';
  loadHistory.mockResolvedValue({ conversations: [], revision: 0 });
  saveHistory.mockResolvedValue({ revision: 1 });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let resolveReply;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'Career directions' }) })
    .mockImplementationOnce(() => new Promise(resolve => { resolveReply = resolve; }));
  try {
    await act(async () => root.render(<ThemeProvider><ChatInterface onToggleView={() => {}} /></ThemeProvider>));
    expect(host.querySelector('main')).not.toBeNull();
    await act(async () => host.querySelector('.starter-prompt').click());
    expect(host.querySelector('textarea').value).toMatch(/interests and strengths/);
    await act(async () => host.querySelector('[aria-label="Send message"]').click());
    expect(host.querySelector('[aria-label="Send message"]').disabled).toBe(true);
    expect(host.querySelector('textarea').disabled).toBe(true);
    expect([...host.querySelectorAll('[role="status"]')].some(el => /Thinking/.test(el.textContent))).toBe(true);
    await act(async () => resolveReply({ ok: false, json: async () => ({ error: 'not configured' }) }));
    expect(host.querySelectorAll('.message-row.user')).toHaveLength(1);
    expect(host.querySelector('.message-row.bot').textContent).toMatch(/Unable to get a response/);
    expect(host.querySelector('textarea').disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    delete global.fetch;
  }
});

test('language changes preserve original history and ignore late translations after a newer message or English selection', async () => {
  const original = [{ id: 'default', title: 'Art', messages: [{ sender: 'bot', text: 'Explore illustration.' }] }];
  loadHistory.mockResolvedValue({ conversations: original, revision: 0 });
  saveHistory.mockClear();
  mockI18n.language = 'es';
  let resolveTranslation;
  translateText.mockImplementationOnce(() => new Promise(resolve => { resolveTranslation = resolve; }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = () => root.render(<ThemeProvider><ChatInterface onToggleView={() => {}} /></ThemeProvider>);
  try {
    await act(async () => render());
    expect(host.querySelector('textarea').disabled).toBe(false);
    mockI18n.language = 'fr';
    translateText.mockResolvedValue('Explorez l’illustration.');
    await act(async () => render());
    expect(host.querySelector('.message-row.bot').textContent).toContain('Explorez');
    await act(async () => resolveTranslation('Explora la ilustración.'));
    expect(host.querySelector('.message-row.bot').textContent).toContain('Explorez');
    mockI18n.language = 'en';
    await act(async () => render());
    expect(host.querySelector('.message-row.bot').textContent).toContain('Explore illustration.');
    expect(saveHistory).not.toHaveBeenCalled();
    expect(original[0].messages[0].text).toBe('Explore illustration.');
    mockI18n.language = 'es';
    translateText.mockImplementationOnce(() => new Promise(resolve => { resolveTranslation = resolve; }));
    await act(async () => render());
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ text: 'Try sketching daily.' }) }));
    translateText.mockResolvedValue('Texto nuevo.');
    await act(async () => {
      const input = host.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'What should I practise?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('[aria-label="Send message"]').click());
    await act(async () => resolveTranslation('Obsolete translation.'));
    expect(host.querySelectorAll('.message-row')).toHaveLength(3);
    expect(host.textContent).not.toContain('Obsolete translation.');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    mockI18n.language = 'en';
    delete global.fetch;
  }
});

test('opening Joe from the mobile sidebar releases the modal before showing the teacher', async () => {
  loadHistory.mockResolvedValue({ conversations: [], revision: 0 });
  const previousWidth = window.innerWidth;
  window.innerWidth = 320;
  window.matchMedia = () => ({ matches: true });
  HTMLDialogElement.prototype.showModal = jest.fn();
  HTMLDialogElement.prototype.close = jest.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const showJoe = jest.fn();
  try {
    await act(async () => root.render(<ThemeProvider><ChatInterface onToggleView={showJoe} /></ThemeProvider>));
    await act(async () => host.querySelector('[aria-label="Open sidebar"]').click());
    expect(host.querySelector('dialog')).not.toBeNull();
    await act(async () => host.querySelector('.voice-entry').click());
    expect(showJoe).toHaveBeenCalledWith(true);
    expect(host.querySelector('dialog')).toBeNull();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.innerWidth = previousWidth;
    window.matchMedia = () => ({ matches: false });
  }
});

test.each(['.voice-entry', '.empty-voice-link'])('opening Joe through %s closes the desktop sidebar before a mobile resize can open a hidden modal', async entry => {
  loadHistory.mockResolvedValue({ conversations: [], revision: 0 });
  const previousWidth = window.innerWidth;
  window.innerWidth = 1440;
  const host = document.createElement('div');
  const root = createRoot(host);
  const showJoe = jest.fn();
  try {
    await act(async () => root.render(<ThemeProvider><ChatInterface onToggleView={showJoe} /></ThemeProvider>));
    expect(host.querySelector('aside')).not.toBeNull();
    await act(async () => host.querySelector(entry).click());
    expect(showJoe).toHaveBeenCalledWith(true);
    expect(host.querySelector('aside')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    window.innerWidth = previousWidth;
  }
});

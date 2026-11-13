import React, { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from './Sidebar';
import MessageBubble from './MessageBubble';
import ThinkingAnimation from './ThinkingAnimation';
import LanguageSelector from './LanguageSelector';
import AddfilesButton from './AddfilesButton.js';
import { API_ENDPOINTS } from '../config/api';
import useConversationHistory from './useConversationHistory';
import { useTranslation } from 'react-i18next';
import { translateText } from '../services/translateText';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/chat-professional.css';
import { ArrowUp, ArrowUpRight, BookOpen, ChatCircleText, Microphone, Moon, Sun, SidebarSimple, Trash, Paperclip, X } from '@phosphor-icons/react';

function ChatInterface({ onToggleView }) {
  const chatEndRef = useRef(null);
  const sidebarTriggerRef = useRef(null);
  const { t, i18n } = useTranslation();
  const { isDarkMode, toggleTheme } = useTheme();

  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState([{
    id: 'default',
    title: 'New Chat',
    messages: [],
  }]);
  const [activeId, setActiveId] = useState('default');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState(null);
  const [translationError, setTranslationError] = useState('');
  const translationCache = useRef(new Map());
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const history = useConversationHistory(conversations, setConversations, setActiveId);
  const isLoadingHistory = !history.ready;

  const activeMessages = useMemo(() => conversations.find(c => c.id === activeId)?.messages || [], [conversations, activeId]);

  // Scroll without creating a second, unscoped copy of private conversations.
  useEffect(() => {
    if (!isLoadingHistory) {
      chatEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' });
    }
  }, [conversations, isLoadingHistory]);

  // Translations are a temporary view, never a write to saved conversation text.
  useEffect(() => {
    const targetLang = i18n.language;
    const controller = new AbortController();
    setTranslationError('');
    setTranslating(false);
    if (!targetLang || targetLang === 'en' || !activeMessages.length || isLoadingHistory) return;
    setTranslating(true);
    async function translateActive() {
      try {
        const texts = [];
        // ponytail: one request per distinct message; long chats may reach the API quota. Upgrade to bounded batches if needed.
        for (const message of activeMessages) {
          const key = JSON.stringify([targetLang, message.text]);
          let text = translationCache.current.get(key);
          if (text === undefined) text = message.text.trim() ? await translateText(message.text, targetLang, controller.signal) : message.text;
          if (controller.signal.aborted) return;
          translationCache.current.set(key, text);
          if (translationCache.current.size > 200) translationCache.current.delete(translationCache.current.keys().next().value);
          texts.push(text);
        }
        setTranslation({ source: activeMessages, language: targetLang, texts });
      } catch {
        if (!controller.signal.aborted) setTranslationError('Translation is unavailable. Showing original messages; your saved history is unchanged.');
      } finally {
        if (!controller.signal.aborted) setTranslating(false);
      }
    }
    translateActive();
    return () => controller.abort();
  }, [i18n.language, activeMessages, isLoadingHistory]);

  // Generate smart title for conversation
  const generateChatTitle = async (firstMessage) => {
    try {
      const res = await fetch(API_ENDPOINTS.GENERATE_TITLE, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMessage }),
      });
      const data = await res.json();
      return data.title || 'New Chat';
    } catch {
      return 'New Chat';
    }
  };

  // Send message
  const handleSend = async () => {
    if (isThinking || isLoadingHistory || !input.trim()) return;

    const newMessage = {
      sender: 'user',
      text: input,
      files: selectedFiles.map(f => f.name)
    };

    const currentConv = conversations.find(c => c.id === activeId);
    const isFirstMessage = currentConv?.messages.length === 0;

    setConversations(prev =>
      prev.map(c =>
        c.id === activeId ? { ...c, messages: [...c.messages, newMessage] } : c
      )
    );

    const userInput = input;
    setInput('');
    setSelectedFiles([]);
    setIsThinking(true);

    // Generate title for first message
    if (isFirstMessage) {
      const newTitle = await generateChatTitle(userInput);
      setConversations(prev =>
        prev.map(c =>
          c.id === activeId ? { ...c, title: newTitle } : c
        )
      );
    }

    // The backend owns provider selection; the legacy endpoint supports all three.
    try {
      const res = await fetch(API_ENDPOINTS.GEMINI, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Unable to get a response. Please check the connection and assistant configuration.');
      const botReply = { sender: 'bot', text: data.text || "Sorry, your AI adviser returned no response." };

      setConversations(prev =>
        prev.map(c =>
          c.id === activeId ? { ...c, messages: [...c.messages, botReply] } : c
        )
      );
    } catch (err) {
      const botReply = { sender: 'bot', text: 'Unable to get a response. Check your connection and the assistant configuration, then try again.' };
      setConversations(prev =>
        prev.map(c =>
          c.id === activeId ? { ...c, messages: [...c.messages, botReply] } : c
        )
      );
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewConversation = () => {
    if (!history.ready || isThinking) return;
    const newId = crypto.randomUUID();
    const newConv = {
      id: newId,
      title: 'New Chat',
      messages: [], // Start with empty messages
    };
    setConversations([newConv, ...conversations]);
    setActiveId(newId);
  };

  const handleClear = () => {
    if (!window.confirm('Clear all conversations? This cannot be undone.')) return;
    const fresh = {
      id: 'default',
      title: 'New Chat',
      messages: [], // Start fresh with no messages
    };
    setConversations([fresh]);
    setActiveId('default');
  };

  
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
    if (sidebarOpen) requestAnimationFrame(() => sidebarTriggerRef.current?.focus());
  };
  const showJoe = () => { setSidebarOpen(false); onToggleView(true); };

  return (
    <div className={`chat-wrapper screen-enter ${isDarkMode ? 'dark' : 'light'} ${sidebarOpen ? 'with-sidebar' : ''}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        setActiveId={setActiveId}
        handleNewConversation={handleNewConversation}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        onToggleView={showJoe}
        hasUnsavedChanges={history.ready && history.status !== 'Saved locally'}
      />
      <main className={`chat-main ${sidebarOpen ? '' : 'full-width'}`}>
        <div className="chat-header">
          <div className="chat-header-title">{!sidebarOpen && <button ref={sidebarTriggerRef} className="icon-button button-quiet" onClick={toggleSidebar} aria-label="Open sidebar"><SidebarSimple size={21} /></button>}<div><span>YOUR WORKSPACE</span><h1>{conversations.find(c => c.id === activeId)?.title || t('defaultChat')}</h1></div></div>
          <div className="header-buttons">
            <button className="icon-button button-quiet" onClick={handleClear} disabled={translating || isThinking || isLoadingHistory} aria-label="Clear all conversations" title="Clear all conversations"><Trash size={19} /></button>
            <button className="icon-button button-quiet" onClick={toggleTheme} aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            <LanguageSelector />
          </div>
        </div>
        <div className="history-status" role="status">{history.error ? <><span>{history.error}</span><button className="button button-quiet" onClick={history.retry}>{history.error.includes('Another tab') ? 'Reload' : 'Retry'}</button></> : history.status}</div>
        <div className="chat-window" role="log" aria-label="Conversation" aria-live="polite">
          {translating && <div className="translating-indicator" role="status">Translating...</div>}
          {translationError && <p role="alert">{translationError}</p>}
           {isLoadingHistory ? <div className="history-loading" role="status"><p>{history.error ? 'Your saved history has not been loaded.' : 'Opening your conversations...'}</p><div className="loading-bars" aria-hidden="true"><span /><span /><span /></div></div> : activeMessages.length === 0 && <div className="chat-empty screen-enter"><span className="empty-symbol"><ChatCircleText size={32} /></span><p className="muted">Your student career adviser.</p><h2>Which career could suit you?</h2><p>Explore your interests, compare careers,<br />and make a learning plan you can start today.</p><div className="starter-grid">{[{ icon: BookOpen, title: 'Explore careers', prompt: 'Help me explore careers that match my interests and strengths.' }, { icon: ChatCircleText, title: 'Build a learning plan', prompt: 'Help me build a practical learning plan for my career goals.' }].map(({ icon: Icon, title, prompt }) => <button className="starter-prompt" key={title} onClick={() => { setInput(prompt); document.getElementById('chat-input')?.focus(); }}><Icon size={22} /><span>{title}</span><ArrowUpRight size={18} /></button>)}</div><button className="empty-voice-link" onClick={showJoe}><Microphone size={18} /> Prefer to talk? Meet Teacher Joe <ArrowUpRight size={16} /></button></div>}
          {activeMessages.map((msg, idx) => (
            <MessageBubble key={idx} sender={msg.sender} text={i18n.language !== 'en' && translation?.source === activeMessages && translation.language === i18n.language ? translation.texts[idx] : msg.text}>
              {msg.files && msg.files.length > 0 && (
                <div className="file-attachment">
                  {msg.files.map((fname, i) => (
                    <div key={i}><Paperclip size={14} /> {fname}</div>
                  ))}
                </div>
              )}
            </MessageBubble>
          ))}
          {isThinking && <ThinkingAnimation />}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-area">
          <div className="input-container">
            {selectedFiles.length > 0 && (
              <div className="file-preview">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="file-tag">
                    <span><Paperclip size={14} /> {file.name}</span>
                    <button onClick={() =>
                      setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))
                    } aria-label={`Remove ${file.name}`}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              id="chat-input"
              className="input-box"
              value={input}
              placeholder={t('placeholder')}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
              rows={2}
              aria-label="Chat Input"
              disabled={isThinking || isLoadingHistory}
            />
            <div className="input-action-buttons">
              <AddfilesButton onFileSelect={(files) => {
                setSelectedFiles(prev => [...prev, ...files]);
              }} />
              <button
                className="send-button"
                onClick={handleSend}
                aria-label="Send message"
                disabled={isThinking || isLoadingHistory || !input.trim()}
              >
                <ArrowUp size={20} />
              </button>
            </div>
          </div>
          <p className="composer-note">{selectedFiles.length > 0 ? 'Files are listed by name only. Their contents are not read.' : 'AI guidance is a starting point. Check important details.'}<span>Enter to send</span></p>
        </div>
      </main>
    </div>
  );
}

export default ChatInterface;

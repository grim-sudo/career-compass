import { useCallback, useEffect, useRef, useState } from 'react';
import { loadHistory, saveHistory } from '../services/localApi';

export default function useConversationHistory(conversations, setConversations, setActiveId) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Opening conversations...');
  const state = useRef({ revision: 0, saved: null, blocked: false, active: false, queue: Promise.resolve() });
  const latest = useRef(conversations);
  latest.current = conversations;

  useEffect(() => {
    const current = state.current;
    current.active = true;
    let cancelled = false;
    loadHistory().then(data => {
      if (cancelled) return;
      current.revision = data.revision;
      const history = data.conversations.length ? data.conversations : [{ id: 'default', title: 'New Chat', messages: [] }];
      current.saved = JSON.stringify(history);
      setConversations(history);
      setActiveId(history[0].id);
      setReady(true);
      setStatus('Saved locally');
    }).catch(() => {
      if (!cancelled) setError('Cannot load saved conversations. Retry before starting a new chat.');
    });
    return () => { cancelled = true; current.active = false; };
  }, [setConversations, setActiveId]);

  const persist = useCallback(snapshot => {
    const current = state.current;
    current.queue = current.queue.then(async () => {
      if (!current.active || current.blocked || snapshot === current.saved) return;
      setStatus('Saving locally...');
      try {
        const data = await saveHistory(JSON.parse(snapshot), current.revision);
        current.revision = data.revision;
        current.saved = snapshot;
        if (current.active) setStatus(snapshot === JSON.stringify(latest.current) ? 'Saved locally' : 'Changes not saved yet');
      } catch (failure) {
        current.blocked = true;
        if (current.active) {
          setStatus('Changes not saved');
          setError(failure.status === 409 ? 'Another tab changed these conversations. Copy any unsaved text, then reload.' : 'Changes are not saved. Keep this tab open and retry.');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(conversations);
    if (snapshot === state.current.saved) return;
    setStatus('Changes not saved yet');
    const timer = setTimeout(() => persist(snapshot), 300);
    return () => clearTimeout(timer);
  }, [conversations, ready, persist]);

  useEffect(() => {
    const warn = event => {
      if (ready && JSON.stringify(latest.current) !== state.current.saved) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ready]);

  const retry = () => {
    if (!ready || error.includes('Another tab')) { window.location.reload(); return; }
    state.current.blocked = false;
    setError('');
    persist(JSON.stringify(latest.current));
  };
  return { ready, error, status, retry };
}

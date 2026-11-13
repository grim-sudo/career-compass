import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useConversationHistory from './useConversationHistory';
import { loadHistory, saveHistory } from '../services/localApi';
jest.mock('../services/localApi', () => ({ loadHistory: jest.fn(), saveHistory: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  const [conversations, setConversations] = useState([]);
  const [, setActiveId] = useState('');
  const history = useConversationHistory(conversations, setConversations, setActiveId);
  return <><span>{history.status}</span><p>{history.error}</p><button disabled={!history.ready} onClick={() => setConversations([{ id: 'first', title: 'Private', messages: [] }])}>Edit</button><button onClick={history.retry}>Retry</button></>;
}

test('failed loads never save empty history; failed saves retry the unchanged revision', async () => {
  jest.useFakeTimers();
  const host = document.createElement('div');
  document.body.append(host);
  let root = createRoot(host);
  try {
    loadHistory.mockRejectedValue(new Error('DB down'));
    await act(async () => root.render(<Harness />));
    expect(host.querySelector('button').disabled).toBe(true);
    await act(async () => jest.advanceTimersByTime(400));
    expect(saveHistory).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(host);
    loadHistory.mockResolvedValue({ conversations: [], revision: 4 });
    saveHistory.mockRejectedValueOnce(new Error('DB down')).mockResolvedValueOnce({ revision: 5 });
    await act(async () => root.render(<Harness />));
    await act(async () => host.querySelector('button').click());
    await act(async () => jest.advanceTimersByTime(400));
    expect(host.querySelector('p').textContent).toMatch(/not saved/);
    expect(saveHistory.mock.calls[0][1]).toBe(4);
    await act(async () => host.querySelectorAll('button')[1].click());
    expect(saveHistory.mock.calls[1][1]).toBe(4);
    expect(host.querySelector('span').textContent).toBe('Saved locally');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    jest.useRealTimers();
  }
});

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import MessageBubble from './MessageBubble';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('bold headings stay bold, list markers require whitespace, and HTML stays text', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MessageBubble sender="bot" text={'**A useful next step**\n* **Star bullet**\n- Dash bullet\n• Dot bullet\n•* Legacy bullet\n*not a bullet\n-not a bullet\n<img src=x onerror=alert(1)>'} />));
    const lines = host.querySelector('.chat-bubble').children;
    expect(lines[0].textContent).toBe('A useful next step');
    expect(lines[0].querySelector('strong').textContent).toBe('A useful next step');
    expect(lines[1].querySelector('strong').textContent).toBe('Star bullet');
    for (const line of Array.from(lines).slice(1, 5)) expect(line.textContent).toMatch(/^•/);
    expect(lines[4].textContent).not.toContain('*');
    expect(lines[5].textContent).toBe('*not a bullet');
    expect(lines[6].textContent).toBe('-not a bullet');
    expect(lines[7].textContent).toBe('<img src=x onerror=alert(1)>');
    expect(host.querySelector('img')).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});

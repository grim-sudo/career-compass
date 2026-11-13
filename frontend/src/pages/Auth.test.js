import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AuthPage from './Auth';
import { authenticate } from '../services/localApi';

jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }), { virtual: true });
jest.mock('../services/localApi', () => ({
  subscribeAuth: callback => { callback(null); return () => {}; },
  authenticate: jest.fn(), logout: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

test('login has connected labels and reports errors inline instead of alerting', async () => {
  authenticate.mockRejectedValue(new Error('The email or password is incorrect. Please try again.'));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AuthPage />));
    expect(host.querySelector('label[for="auth-email"]')).not.toBeNull();
    expect(host.querySelector('#auth-email').getAttribute('autocomplete')).toBe('email');
    await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/email or password/i);
    expect(host.querySelector('button[type="submit"]').disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

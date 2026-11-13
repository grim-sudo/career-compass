import { translateText } from './translateText';

afterEach(() => { delete global.fetch; });

test('translation uses the authenticated same-origin server and supports long assistant replies', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ text: 'Hola estudiante.' }) }));
  const controller = new AbortController();
  expect(await translateText('Hello student.', 'es', controller.signal)).toBe('Hola estudiante.');
  expect(global.fetch).toHaveBeenCalledWith('/api/translate', expect.objectContaining({
    credentials: 'include', signal: controller.signal,
    body: JSON.stringify({ text: 'Hello student.', targetLang: 'es' }),
  }));
  await translateText('x'.repeat(9000), 'es');
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).text).toHaveLength(9000);
});

test('English keeps the original and translation failures are reported instead of silently succeeding', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: 'Unavailable' }) }));
  expect(await translateText('Original', 'en')).toBe('Original');
  expect(global.fetch).not.toHaveBeenCalled();
  await expect(translateText('Original', 'es')).rejects.toThrow();
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ text: {} }) });
  await expect(translateText('Original', 'es')).rejects.toThrow();
});

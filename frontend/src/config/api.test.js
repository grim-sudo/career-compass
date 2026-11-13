test('API requests stay same-origin even with a stale development URL', () => {
  const previous = process.env.REACT_APP_API_URL;
  process.env.REACT_APP_API_URL = 'http://localhost:5000';
  try {
    const { default: base, API_ENDPOINTS } = require('./api');
    expect(base).toBe('');
    expect(API_ENDPOINTS.GEMINI).toBe('/api/gemini');
    expect(API_ENDPOINTS.HEALTH).toBe('/api/health');
  } finally {
    if (previous === undefined) delete process.env.REACT_APP_API_URL;
    else process.env.REACT_APP_API_URL = previous;
  }
});

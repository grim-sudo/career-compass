// Docker serves both layers; CRA proxies /api during native development.
const API_BASE_URL = '';

export const API_ENDPOINTS = {
  BASE: API_BASE_URL,
  GEMINI: `${API_BASE_URL}/api/gemini`,
  GENERATE_TITLE: `${API_BASE_URL}/api/generate-title`,
  TRANSLATE: `${API_BASE_URL}/api/translate`,
  HEALTH: `${API_BASE_URL}/api/health`,
};

export default API_BASE_URL;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import LandingPage from './LandingPage';
import { ThemeProvider } from '../contexts/ThemeContext';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }), { virtual: true });
jest.mock('../components/StudentScene', () => () => <div>Student illustration</div>);
jest.mock('./Auth', () => () => <div>Account form</div>);
jest.mock('gsap', () => {
  return { registerPlugin: jest.fn(), matchMedia: jest.fn(), from: jest.fn(), fromTo: jest.fn(), utils: { toArray: selector => [...global.document.querySelectorAll(selector)] } };
});
jest.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { refresh: jest.fn() } }));
jest.mock('@gsap/react', () => ({ useGSAP: callback => require('react').useLayoutEffect(callback, []) }));
global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false });

test('scroll choreography is preference-gated, refreshes after topic changes and cleans up on exit', async () => {
  const media = { add: jest.fn(), revert: jest.fn() };
  gsap.matchMedia.mockReturnValue(media);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ThemeProvider><LandingPage /></ThemeProvider>));
    const [query, animate] = media.add.mock.calls.at(-1);
    expect(query).toBe('(prefers-reduced-motion: no-preference)');
    expect(gsap.from).not.toHaveBeenCalled();
    animate();
    const features = gsap.from.mock.calls.filter(([element]) => element?.classList?.contains('feature-panel'));
    expect(features).toHaveLength(3);
    expect(features.map(([, settings]) => settings.delay)).toEqual([0, .1, .2]);
    for (const [, settings] of features) expect(settings.scrollTrigger.once).toBe(true);
    const drifts = gsap.fromTo.mock.calls.filter(([element]) => element?.classList?.contains('hero-visual') || element?.classList?.contains('voice-editorial-image'));
    expect(drifts).toHaveLength(2);
    for (const [, start, end] of drifts) {
      expect(start.y).toBe(-12);
      expect(end.y).toBe(12);
      expect(end.scrollTrigger.scrub).toBe(.8);
      expect(end.scrollTrigger.pin).toBeUndefined();
    }
    const refreshes = ScrollTrigger.refresh.mock.calls.length;
    await act(async () => host.querySelectorAll('.topic-panel button')[1].click());
    expect(ScrollTrigger.refresh.mock.calls.length).toBe(refreshes + 1);
    await act(async () => root.unmount());
    expect(media.revert).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

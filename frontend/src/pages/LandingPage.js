import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ArrowLeft, ChatCircleText, BookOpen, Microphone, Sun, Moon, X } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useTheme } from '../contexts/ThemeContext';
import Brand from '../components/Brand';
import StudentScene from '../components/StudentScene';
import AuthPage from './Auth';
import '../styles/landing-beautiful.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);
const topics = [
  { title: 'Compare careers', description: 'Talk about your favourite subjects, strengths and interests. Compare what different careers actually involve.', scene: 'choose', prompt: 'How do I choose a career that fits my strengths?' },
  { title: 'Make a learning plan', description: 'Choose a skill to explore, a small project to try and a realistic weekly study plan.', scene: 'learn', prompt: 'Help me create a learning plan for a new career.' },
  { title: 'Prepare for internships', description: 'Work on your first resume, practise interview questions and understand what employers look for.', scene: 'ask', prompt: 'How should I prepare for my first internship interview?' },
];

export default function LandingPage({ onAuthSuccess }) {
  const [authMode, setAuthMode] = useState(null);
  const [activeTopic, setActiveTopic] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const pageRef = useRef(null);
  const dialogRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authMode) return;
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    dialogRef.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, [authMode]);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.hero-enter', { opacity: 0, y: 24, duration: .9, stagger: .1, ease: 'power3.out' });
      gsap.utils.toArray('.reveal:not(.feature-panel), .explore-intro, .prompt-carousel, .voice-editorial-copy').forEach(element => gsap.from(element, { opacity: 0, y: 28, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } }));
      gsap.utils.toArray('.feature-panel').forEach((element, index) => gsap.from(element, { opacity: 0, y: 36, duration: .9, delay: index * .1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true } }));
      gsap.utils.toArray('.hero-visual, .voice-editorial-image').forEach(element => gsap.fromTo(element, { y: -12 }, { y: 12, ease: 'none', scrollTrigger: { trigger: element.parentElement, start: 'top bottom', end: 'bottom top', scrub: .8 } }));
      gsap.fromTo('.story-word', { '--story-progress': 0 }, { '--story-progress': 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: '.story-copy', start: 'top 85%', end: 'bottom 55%', scrub: true } });
    });
    return () => media.revert();
  }, { scope: pageRef });
  useEffect(() => { ScrollTrigger.refresh(); }, [activeTopic]);

  const finishAuth = () => { setAuthMode(null); onAuthSuccess?.(); navigate('/chat'); };

  return (
    <div className="landing-page" ref={pageRef}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="landing-header">
        <a href="/" aria-label="Career Compass home"><Brand /></a>
        <nav aria-label="Main navigation"><a href="#explore">Explore careers</a><a href="#voice">Meet Teacher Joe</a></nav>
        <div className="nav-actions">
          <button className="icon-button button-quiet" aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} onClick={toggleTheme}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          <button className="button button-quiet login-link" onClick={() => setAuthMode('login')}>Login</button>
          <button className="button button-primary" onClick={() => setAuthMode('signup')}>Sign Up <ArrowUpRight size={16} /></button>
        </div>
      </header>

      <main id="main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-eyebrow hero-enter">FOR THE “WHAT SHOULD I DO?” YEARS.</p>
            <h1 className="hero-enter">Your interests.<br /><span>Your future career.</span></h1>
            <p className="hero-description hero-enter">Not sure what to choose? Explore careers, ask questions, and build a learning plan with your student career adviser.</p>
            <div className="hero-actions hero-enter"><button className="button button-primary" onClick={() => setAuthMode('signup')}>Sign Up <ArrowRight size={18} /></button><a className="button button-quiet" href="#explore">See how it works <ArrowUpRight size={18} /></a></div>
          </div>
          <div className="hero-visual"><StudentScene /></div>
        </section>

        <section className="possibilities-section page-section" id="possibilities">
          <div className="section-heading reveal"><h2>You don't need it all figured out.</h2><p>Start with a question. Work towards a choice that makes sense for you.</p></div>
          <div className="feature-grid">
            <a className="feature-panel feature-main reveal" href="#explore"><StudentScene variant="learn" compact /><div className="feature-copy"><BookOpen size={24} /><h3>Learn something. Try something.</h3><p>Turn “I might like this” into a skill and a small project.</p><ArrowUpRight size={22} /></div></a>
            <a className="feature-panel feature-chat reveal" href="#explore"><ChatCircleText size={32} /><div><h3>Ask without overthinking.</h3><p>Which degree? What skills? What does the job really look like?</p></div><span className="feature-link">Career questions <ArrowUpRight size={20} /></span></a>
            <a className="feature-panel feature-voice reveal" href="#voice"><Microphone size={32} /><div><h3>Talk to Teacher Joe.</h3><p>Ask your career questions out loud in the voice preview.</p></div><span className="feature-link">Meet your adviser <ArrowUpRight size={20} /></span></a>
          </div>
        </section>

        <section className="explore-section page-section" id="explore">
          <div className="explore-intro"><h2>Big career questions.<br />Practical answers.</h2><p>You bring your interests and questions.<br />We'll help you compare, learn and prepare.</p><div className="explore-example"><span>IT'S OKAY TO ASK</span><p>“What if I like more than one thing?”</p></div></div>
          <div className="topic-panels">
            {topics.map((topic, index) => <article className={`topic-panel ${activeTopic === index ? 'expanded' : ''}`} key={topic.title}><h3><button aria-expanded={activeTopic === index} aria-controls={`topic-${index}`} onClick={() => setActiveTopic(index)}><span><small>0{index + 1}</small>{topic.title}</span><ArrowUpRight size={22} /></button></h3><div id={`topic-${index}`} hidden={activeTopic !== index}>{activeTopic === index && <><p>{topic.description}</p><StudentScene variant={topic.scene} compact /></>}</div></article>)}
            <div className="prompt-carousel" aria-roledescription="carousel" aria-label="Example career questions"><span className="muted">A question to start with</span><p key={promptIndex} className="screen-enter" aria-live="polite">“{topics[promptIndex].prompt}”</p><div className="carousel-controls"><button className="icon-button" aria-label="Previous example question" onClick={() => setPromptIndex((promptIndex + 2) % 3)}><ArrowLeft size={18} /></button><button className="icon-button" aria-label="Next example question" onClick={() => setPromptIndex((promptIndex + 1) % 3)}><ArrowRight size={18} /></button></div></div>
          </div>
        </section>

        <section className="voice-section page-section" id="voice"><div className="voice-editorial-image"><StudentScene variant="ask" compact /></div><div className="voice-editorial-copy"><Microphone size={28} /><h2>A question is a good start.</h2><p className="story-copy">{'Meet Teacher Joe in the voice workspace. Ask about courses, careers or your first interview, and talk through a practical next step.'.split(' ').map((word, index) => <span className="story-word" key={index}>{word} </span>)}</p><button className="button" onClick={() => setAuthMode('login')}>Login <ArrowUpRight size={18} /></button><small>Browser speech with approximate lip-sync. Voices and speech boundaries depend on your browser.</small></div></section>

        <section className="final-cta page-section reveal"><p>No perfect plan required.</p><h2>Let's explore your career options.</h2><button className="button button-primary" onClick={() => setAuthMode('signup')}>Sign Up <ArrowUpRight size={20} /></button></section>
      </main>
      <footer className="landing-footer"><Brand /><p>Career questions. Learning plans. Student support.</p><span>© {new Date().getFullYear()} Career Compass</span></footer>

      {authMode && <dialog className="auth-dialog" ref={dialogRef} aria-labelledby="auth-title" onClose={() => setAuthMode(null)} onCancel={() => setAuthMode(null)} onClick={event => { if (event.target === event.currentTarget) setAuthMode(null); }}><div className="auth-dialog-layout"><aside className="auth-art"><Brand /><img src="/images/students/sitting-reading.svg" alt="A student considering their career interests" width="1024" height="768" /><p>Your questions.<br />Your career choices.</p></aside><AuthPage initialMode={authMode} onAuthSuccess={finishAuth} /><button className="icon-button button-quiet auth-dialog-close" aria-label="Close login dialog" onClick={() => setAuthMode(null)}><X size={20} /></button></div></dialog>}
    </div>
  );
}

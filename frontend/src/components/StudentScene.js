import React, { useRef } from 'react';
import { Code, PencilRuler, Flask, Check, ChatCircleText } from '@phosphor-icons/react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);
const scenes = {
  choose: { image: 'sitting', question: 'Design? Science? Coding? What suits me?', answer: 'Let’s start with what you enjoy.', alt: 'A student considering which career to choose' },
  learn: { image: 'reading', question: 'I like design. What should I learn first?', answer: 'Try one small project. Build from there.', alt: 'A student reading and making a learning plan' },
  ask: { image: 'sitting-reading', question: 'What is an internship interview like?', answer: 'We can practise your first answer together.', alt: 'A student asking for advice before an interview' },
};

export default function StudentScene({ variant = 'choose', compact = false }) {
  const ref = useRef(null);
  const scene = scenes[variant];
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      // Finite sequence: student's question, relevant choices, then adviser response.
      const timeline = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 92%', once: true } });
      timeline.from('.student-character', { y: 16, opacity: 0, duration: .65, ease: 'power3.out' })
        .from('.student-question', { y: 10, opacity: 0, scale: .95, duration: .45 }, '-=.3')
        .from('.scene-detail', { y: 12, opacity: 0, duration: .4, stagger: .12 }, '-=.1')
        .from('.student-answer', { y: 10, opacity: 0, duration: .45 }, '+=.25');
    });
    return () => media.revert();
  }, { scope: ref, dependencies: [variant], revertOnUpdate: true });

  return (
    <div ref={ref} className={`student-scene scene-${variant} ${compact ? 'scene-compact' : ''}`}>
      <p className="student-question">{scene.question}</p>
      <img className="student-character" src={`/images/students/${scene.image}.svg`} alt={scene.alt} width="1024" height="768" loading={compact ? 'lazy' : 'eager'} />
      {variant === 'choose' ? <div className="career-choices" aria-label="Example career interests">{[{ Icon: PencilRuler, text: 'Design' }, { Icon: Flask, text: 'Science' }, { Icon: Code, text: 'Technology' }].map(({ Icon, text }) => <span className="scene-detail" key={text}><Icon size={18} />{text}</span>)}</div> : variant === 'learn' ? <div className="scene-plan"><span className="scene-detail"><Check size={16} /> Explore the basics</span><span className="scene-detail"><Check size={16} /> Make a small project</span><span className="scene-detail"><Check size={16} /> Get feedback</span></div> : <span className="scene-detail scene-interview"><ChatCircleText size={18} /> Tell me about yourself...</span>}
      <p className="student-answer"><ChatCircleText size={18} /><span>{scene.answer}</span></p>
    </div>
  );
}

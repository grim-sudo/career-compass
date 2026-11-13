import React from 'react';
import '../styles/thinking-animation.css';

export default function ThinkingAnimation() {
  return <div className="thinking-container" role="status"><span>Thinking it through...</span><div className="thinking-dots" aria-hidden="true"><span /><span /><span /></div></div>;
}

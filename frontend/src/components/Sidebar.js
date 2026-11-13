import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../services/localApi';
import { Plus, ChatCircleText, Microphone, SignOut, SidebarSimple, ArrowUpRight } from '@phosphor-icons/react';
import Brand from './Brand';

export default function Sidebar({ conversations, activeId, setActiveId, handleNewConversation, sidebarOpen, toggleSidebar, onToggleView, hasUnsavedChanges = false }) {
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const dialogRef = useRef(null);
  const navigate = useNavigate();
  const user = getCurrentUser();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !sidebarOpen) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); previousFocus?.focus(); };
  }, [mobile, sidebarOpen]);
  if (!sidebarOpen) return null;
  const Navigation = mobile ? 'dialog' : 'aside';
  const handleLogout = async () => {
    if (hasUnsavedChanges && !window.confirm('Some changes are not saved. Log out and discard those changes?')) return;
    try { await logout(); navigate('/'); }
    catch { setError('Unable to log out. Please try again.'); }
  };
  const selectConversation = (id) => {
    setActiveId(id);
    if (window.matchMedia('(max-width: 767px)').matches) toggleSidebar();
  };
  return (
    <>
      <Navigation ref={mobile ? dialogRef : undefined} className="sidebar screen-enter" aria-label="Workspace navigation" onCancel={event => { event.preventDefault(); toggleSidebar(); }}>
        <div className="sidebar-header"><a href="/" aria-label="Career Compass home"><Brand /></a><button className="icon-button button-quiet" onClick={toggleSidebar} aria-label="Close sidebar"><SidebarSimple size={19} /></button></div>
        <button className="button button-primary new-button" onClick={handleNewConversation}><Plus size={18} /> New Chat</button>
        <div className="sidebar-section-heading">Your conversations <span>{conversations.length}</span></div>
        <nav className="conversation-list" aria-label="Conversation list">
          {conversations.map(conversation => <button key={conversation.id} className={conversation.id === activeId ? 'active' : ''} onClick={() => selectConversation(conversation.id)} aria-current={conversation.id === activeId ? 'page' : undefined}><ChatCircleText size={18} /><span>{conversation.title}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="voice-entry" onClick={() => { if (mobile) dialogRef.current.close(); onToggleView(true); }}><Microphone size={24} /><span><strong>Talk Live</strong><small>Think it through with Teacher Joe</small></span><ArrowUpRight size={16} /></button>
          <div className="sidebar-account"><span className="account-initial" aria-hidden="true">{(user?.displayName || user?.email || 'Y')[0].toUpperCase()}</span><span><strong>{user?.displayName || 'Your workspace'}</strong><small>Career Compass</small></span><button className="icon-button button-quiet" onClick={handleLogout} aria-label="Log out"><SignOut size={20} /></button></div>
          {error && <p role="alert" className="workspace-error">{error}</p>}
        </div>
      </Navigation>
    </>
  );
}

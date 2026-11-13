import React, { useRef } from 'react';
import { Paperclip } from '@phosphor-icons/react';

export default function AddfilesButton({ onFileSelect }) {
  const inputRef = useRef(null);
  return <><button className="icon-button button-quiet" aria-label="Add file names" title="Files are listed by name only" onClick={() => inputRef.current.click()}><Paperclip size={21} /></button><input ref={inputRef} type="file" multiple hidden onChange={event => { const files = Array.from(event.target.files); if (files.length) onFileSelect?.(files); event.target.value = ''; }} /></>;
}

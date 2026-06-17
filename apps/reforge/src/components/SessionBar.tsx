import { exportFileName, parseSessionExport, serializeSession } from '@/lib/sessionIo';
import type { MilestoneInput, Session } from '@/types/reforge';
/**
 * Session switcher + manager. A compact header row with a native `<select>` to
 * switch the active session, a "New" button, and a kebab menu to rename (inline),
 * export, import, or delete the active session. Native controls keep it
 * accessible and mobile friendly; the menu closes on outside-click / Escape.
 */
import { Check, ChevronDown, Download, FolderOpen, MoreVertical, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Trigger a client-side download of `contents` as a file. The anchor is added to
// the DOM before clicking (some browsers require it) and cleaned up after.
function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface Props {
  sessions: Session[];
  activeSessionId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onImport: (name: string, inputs: MilestoneInput[]) => void;
}

// Soft cap so a long name cannot break the layout; rename trims before saving.
const MAX_NAME_LENGTH = 40;

export function SessionBar({ sessions, activeSessionId, onSwitch, onCreate, onRename, onDelete, onImport }: Props) {
  const active = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close the manage menu on an outside click or Escape; restore focus to the
  // trigger so keyboard users are not stranded.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function startRename() {
    setDraft(active.name);
    setRenaming(true);
    setMenuOpen(false);
  }

  function commitRename() {
    const name = draft.trim();
    if (name) onRename(active.id, name);
    setRenaming(false);
  }

  function handleDelete() {
    setMenuOpen(false);
    if (window.confirm(`Delete "${active.name}"? This removes the session and all its milestones.`)) {
      onDelete(active.id);
    }
  }

  function handleExport() {
    setMenuOpen(false);
    downloadJson(exportFileName(active.name), serializeSession(active));
  }

  // Read the chosen file, validate/sanitize it, and import as a new session.
  // Capture the element before awaiting and clear it in `finally` so picking the
  // same file again still fires a change event.
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = parseSessionExport(await file.text());
      if (result.ok) onImport(result.name, result.inputs);
      else window.alert(result.error);
    } finally {
      input.value = '';
    }
  }

  return (
    <section className='relative z-20 flex items-center gap-2 rounded-xl border border-border bg-surface p-3'>
      {/* Persistent hidden input so the ref stays valid after the menu closes. */}
      <input ref={fileInputRef} type='file' accept='application/json,.json' onChange={handleFile} className='hidden' aria-hidden='true' tabIndex={-1} />

      <FolderOpen size={16} className='shrink-0 text-gold' />

      {renaming ? (
        <form
          className='flex flex-1 items-center gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <input
            type='text'
            value={draft}
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setRenaming(false);
            }}
            aria-label='Session name'
            className='min-w-0 flex-1 rounded-lg border border-border bg-bg/40 px-3 py-1.5 text-sm'
          />
          <button
            type='submit'
            disabled={!draft.trim()}
            aria-label='Save name'
            className='rounded-md border border-gold/50 bg-gold/10 p-1.5 text-gold transition-colors hover:bg-gold/20 disabled:opacity-40'
          >
            <Check size={15} />
          </button>
          <button
            type='button'
            onClick={() => setRenaming(false)}
            aria-label='Cancel rename'
            className='rounded-md border border-border p-1.5 text-muted transition-colors hover:bg-surface-hover'
          >
            <X size={15} />
          </button>
        </form>
      ) : (
        <>
          <label htmlFor='session-select' className='sr-only'>
            Active session
          </label>
          <div className='relative min-w-0 flex-1'>
            <select
              id='session-select'
              value={active.id}
              onChange={(e) => onSwitch(e.target.value)}
              className='w-full appearance-none truncate rounded-lg border border-border bg-bg/40 px-3 py-1.5 pr-8 text-sm font-medium'
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted' />
          </div>

          <button
            type='button'
            onClick={onCreate}
            className='inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-surface-hover'
          >
            <Plus size={15} />
            <span className='hidden sm:inline'>New</span>
          </button>

          <div className='relative shrink-0' ref={menuRef}>
            <button
              type='button'
              ref={menuButtonRef}
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup='menu'
              aria-expanded={menuOpen}
              aria-label='Manage session'
              className='rounded-lg border border-border p-1.5 text-muted transition-colors hover:bg-surface-hover'
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div role='menu' className='absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg'>
                <button
                  type='button'
                  role='menuitem'
                  onClick={startRename}
                  className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover'
                >
                  <Pencil size={14} /> Rename
                </button>
                <button
                  type='button'
                  role='menuitem'
                  onClick={handleExport}
                  className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover'
                >
                  <Download size={14} /> Export
                </button>
                <button
                  type='button'
                  role='menuitem'
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover'
                >
                  <Upload size={14} /> Import
                </button>
                <button
                  type='button'
                  role='menuitem'
                  onClick={handleDelete}
                  className='flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-red transition-colors hover:bg-red/10'
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

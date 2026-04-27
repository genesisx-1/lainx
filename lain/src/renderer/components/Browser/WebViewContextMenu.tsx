import React, { useEffect, useRef } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useBookmarksStore } from '../../store/bookmarks.store';
import { useUIStore } from '../../store/ui.store';

interface ContextMenuProps {
  x: number;
  y: number;
  linkUrl?: string;
  imageUrl?: string;
  selectedText?: string;
  pageUrl: string;
  pageTitle: string;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
}

export function WebViewContextMenu({
  x,
  y,
  linkUrl,
  imageUrl,
  selectedText,
  pageUrl,
  pageTitle,
  onClose,
  onNavigate,
  onOpenInNewTab
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { webviewApi } = useBrowserStore();
  const { isBookmarked, toggleBookmark } = useBookmarksStore();
  const { setTerminalOpen, queueTerminalCommand } = useUIStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onClose();
  };

  const searchGoogle = (text: string) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    onOpenInNewTab(url);
    onClose();
  };

  const runInTerminal = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const looksDangerous =
      trimmed.includes('\n') ||
      /\brm\s+-rf\b/i.test(trimmed) ||
      /\bsudo\b/i.test(trimmed) ||
      /\bcurl\b.*\|\s*sh\b/i.test(trimmed) ||
      /\bwget\b.*\|\s*sh\b/i.test(trimmed);

    if (looksDangerous) {
      const ok = window.confirm(
        `This looks like it could be dangerous to run automatically:\n\n${trimmed.slice(0, 400)}\n\nRun it in the terminal?`
      );
      if (!ok) {
        onClose();
        return;
      }
    }

    setTerminalOpen(true);
    queueTerminalCommand(trimmed, { run: true });
    onClose();
  };

  const MenuItem = ({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-secondary ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-text-primary'
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="my-1 border-t border-border" />;

  // Adjust position to stay in viewport
  let posX = x;
  let posY = y;
  const menuWidth = 200;
  const menuHeight = 300;
  
  if (posX + menuWidth > window.innerWidth) {
    posX = window.innerWidth - menuWidth - 10;
  }
  if (posY + menuHeight > window.innerHeight) {
    posY = window.innerHeight - menuHeight - 10;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-primary border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: posX, top: posY }}
    >
      {/* Link actions */}
      {linkUrl && (
        <>
          <MenuItem onClick={() => { onNavigate(linkUrl); onClose(); }}>
            Open Link
          </MenuItem>
          <MenuItem onClick={() => { onOpenInNewTab(linkUrl); onClose(); }}>
            Open in New Tab
          </MenuItem>
          <MenuItem onClick={() => copyToClipboard(linkUrl)}>
            Copy Link Address
          </MenuItem>
          <Divider />
        </>
      )}

      {/* Image actions */}
      {imageUrl && (
        <>
          <MenuItem onClick={() => { onOpenInNewTab(imageUrl); onClose(); }}>
            Open Image in New Tab
          </MenuItem>
          <MenuItem onClick={() => copyToClipboard(imageUrl)}>
            Copy Image Address
          </MenuItem>
          <Divider />
        </>
      )}

      {/* Text selection actions */}
      {selectedText && (
        <>
          <MenuItem onClick={() => copyToClipboard(selectedText)}>
            Copy Selected Text
          </MenuItem>
          <MenuItem onClick={() => searchGoogle(selectedText)}>
            Search Google for "{selectedText.slice(0, 20)}{selectedText.length > 20 ? '...' : ''}"
          </MenuItem>
          <MenuItem onClick={() => runInTerminal(selectedText)}>
            Run in Terminal
          </MenuItem>
          <Divider />
        </>
      )}

      {/* Navigation actions */}
      <MenuItem onClick={() => { webviewApi?.goBack(); onClose(); }}>
        Back
      </MenuItem>
      <MenuItem onClick={() => { webviewApi?.goForward(); onClose(); }}>
        Forward
      </MenuItem>
      <MenuItem onClick={() => { webviewApi?.reload(); onClose(); }}>
        Reload
      </MenuItem>

      <Divider />

      {/* Bookmark */}
      <MenuItem onClick={() => { toggleBookmark(pageUrl, pageTitle); onClose(); }}>
        {isBookmarked(pageUrl) ? 'Remove Bookmark' : 'Add Bookmark'}
      </MenuItem>

      {/* Copy page URL */}
      <MenuItem onClick={() => copyToClipboard(pageUrl)}>
        Copy Page URL
      </MenuItem>
    </div>
  );
}

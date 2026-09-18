import React, { createContext, useContext, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  /** Optional override for the full-screen overlay (e.g. a higher z-index so a
   * confirmation dialog can stack above another already-open modal). */
  overlayStyle?: React.CSSProperties;
  ariaLabel?: string;
}

interface OpenModal {
  id: string;
  parentId: string | null;
  overlay: HTMLDivElement;
  content: HTMLDivElement;
  opener: HTMLElement | null;
  close: () => void;
}

const ParentModal = createContext<string | null>(null);
const openModals: OpenModal[] = [];
const inertElements = new Map<Element, string | null>();
let bodyObserver: MutationObserver | null = null;

function topModal() {
  // Match actual paint order: explicit overlay z-index first, portal order second.
  return openModals.reduce<OpenModal | null>((top, modal) => {
    const zIndex = (element: HTMLElement) => Number.parseFloat(getComputedStyle(element).zIndex) || 0;
    if (!top) return modal;
    const difference = zIndex(modal.overlay) - zIndex(top.overlay);
    return difference > 0 || (difference === 0 &&
      !!(top.overlay.compareDocumentPosition(modal.overlay) & Node.DOCUMENT_POSITION_FOLLOWING)) ? modal : top;
  }, null);
}

function canFocus(element: HTMLElement | null): element is HTMLElement {
  return !!element && element.isConnected &&
    (element.tabIndex >= 0 || element.hasAttribute('tabindex') || element.isContentEditable) &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    !element.matches(':disabled, input[type="hidden"]') &&
    element.getClientRects().length > 0 &&
    !['hidden', 'collapse'].includes(getComputedStyle(element).visibility);
}

function tabStops(content: HTMLElement) {
  const elements = Array.from(content.querySelectorAll<HTMLElement>(
    'a[href], area[href], button, input, select, textarea, iframe, object, embed, ' +
    '[tabindex], [contenteditable], audio[controls], video[controls], summary',
  )).filter((element) => canFocus(element) && (
    element.tabIndex >= 0 ||
    (element.isContentEditable && !element.hasAttribute('tabindex') && !element.parentElement?.isContentEditable)
  ));

  return elements.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
    const group = elements.filter((other) => other instanceof HTMLInputElement &&
      other.type === 'radio' && other.name === element.name && other.form === element.form);
    return element === (group.find((other) => (other as HTMLInputElement).checked) ?? group[0]);
  }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

function syncIsolation() {
  const top = topModal();
  for (const [element, previous] of inertElements) {
    if (!top || element === top.overlay || element.parentElement !== document.body) {
      if (previous === null) element.removeAttribute('inert');
      else element.setAttribute('inert', previous);
      inertElements.delete(element);
    }
  }
  if (top) {
    for (const element of Array.from(document.body.children)) {
      if (element === top.overlay) continue;
      if (!inertElements.has(element)) inertElements.set(element, element.getAttribute('inert'));
      element.setAttribute('inert', '');
    }
  }
}

function focusTopModal() {
  const top = topModal();
  if (top && !top.content.contains(document.activeElement)) top.content.focus({ preventScroll: true });
}

function handleKeyDown(event: KeyboardEvent) {
  const top = topModal();
  if (!top || event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    top.close();
  } else if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    const stops = tabStops(top.content);
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? stops.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
    // Keyboard navigation must reveal offscreen controls in scrollable dialogs.
    (stops[next] ?? top.content).focus();
  }
}

function registerModal(modal: OpenModal) {
  // Nested layout effects run child-first. Keep a parent before its child both
  // in the registry and in the body, so equal-z-index confirmations stay above it.
  const childIndex = openModals.findIndex((entry) => entry.parentId === modal.id);
  if (childIndex < 0) openModals.push(modal);
  else {
    document.body.insertBefore(modal.overlay, openModals[childIndex].overlay);
    openModals.splice(childIndex, 0, modal);
  }

  if (openModals.length === 1) {
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', focusTopModal, true);
    bodyObserver = new MutationObserver(() => {
      syncIsolation();
      focusTopModal();
    });
    bodyObserver.observe(document.body, { childList: true });
  }
  syncIsolation();
  focusTopModal();
}

function unregisterModal(modal: OpenModal) {
  const wasTop = topModal() === modal;
  openModals.splice(openModals.indexOf(modal), 1);
  const remaining = [...openModals];
  if (!openModals.length) {
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', focusTopModal, true);
    bodyObserver?.disconnect();
    bodyObserver = null;
  }
  syncIsolation();
  const next = topModal();
  // Wait for removed DOM/refs to settle, and ignore StrictMode effect replays
  // or another modal opening before this cleanup's focus restoration runs.
  queueMicrotask(() => {
    if (openModals.some((entry) => entry.id === modal.id)) return;
    // A parent can disappear before its confirmation. Preserve the return path,
    // but only after ruling out an effect replay that leaves the opener mounted.
    for (const entry of remaining) {
      if (entry.opener && modal.content.contains(entry.opener)) entry.opener = modal.opener;
    }
    if (!wasTop || topModal() !== next) return;
    if (canFocus(modal.opener) && (!next || next.content.contains(modal.opener))) {
      modal.opener.focus({ preventScroll: true });
    }
    focusTopModal();
  });
}

/** Shared RTL dialog with a single, stack-aware focus and dismissal boundary. */
export const Modal: React.FC<ModalProps> = ({ onClose, children, contentStyle, overlayStyle, ariaLabel }) => {
  const id = useId();
  const parentId = useContext(ParentModal);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Capture before commit, since a child's autoFocus may run before our effect.
  const previouslyFocused = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const modal: OpenModal = {
      id,
      parentId,
      overlay: overlayRef.current!,
      content: contentRef.current!,
      opener: previouslyFocused.current,
      close: () => onCloseRef.current(),
    };
    registerModal(modal);
    return () => {
      unregisterModal(modal);
      previouslyFocused.current = modal.opener;
    };
  }, [id, parentId]);

  // Re-evaluate visual priority when a consumer changes overlayStyle.zIndex.
  useLayoutEffect(() => {
    syncIsolation();
    focusTopModal();
  });

  if (typeof document === 'undefined') return null;
  return createPortal(
    <ParentModal.Provider value={id}>
      <div
        ref={overlayRef}
        className="modal-overlay"
        style={{ direction: 'rtl', ...overlayStyle }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && topModal()?.id === id) {
            event.stopPropagation();
            onCloseRef.current();
          }
        }}
      >
        <div
          ref={contentRef}
          className="modal-content"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{ outline: 'none', ...contentStyle }}
        >
          {children}
        </div>
      </div>
    </ParentModal.Provider>,
    document.body,
  );
};

export default Modal;

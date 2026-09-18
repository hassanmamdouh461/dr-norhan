import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './ui/Modal';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function touchDistance(t1: React.Touch, t2: React.Touch) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

/** صورة قابلة للنقر لعرضها مكبّرة مع إمكانية التكبير/التصغير والسحب (فأرة أو لمس). */
export const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt = '', style, className }) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const gesture = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pinching: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
  });

  const close = () => {
    setOpen(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => setScale((s) => clampScale(s + SCALE_STEP));
  const zoomOut = () =>
    setScale((s) => {
      const next = clampScale(s - SCALE_STEP);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === MIN_SCALE) return;
    gesture.current.dragging = true;
    gesture.current.startX = e.clientX;
    gesture.current.startY = e.clientY;
    gesture.current.originX = offset.x;
    gesture.current.originY = offset.y;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!gesture.current.dragging) return;
    setOffset({
      x: gesture.current.originX + (e.clientX - gesture.current.startX),
      y: gesture.current.originY + (e.clientY - gesture.current.startY),
    });
  };
  const stopDrag = () => {
    gesture.current.dragging = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      gesture.current.pinching = true;
      gesture.current.pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
      gesture.current.pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > MIN_SCALE) {
      gesture.current.dragging = true;
      gesture.current.startX = e.touches[0].clientX;
      gesture.current.startY = e.touches[0].clientY;
      gesture.current.originX = offset.x;
      gesture.current.originY = offset.y;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (gesture.current.pinching && e.touches.length === 2) {
      const dist = touchDistance(e.touches[0], e.touches[1]);
      setScale(clampScale(gesture.current.pinchStartScale * (dist / gesture.current.pinchStartDist)));
    } else if (gesture.current.dragging && e.touches.length === 1) {
      setOffset({
        x: gesture.current.originX + (e.touches[0].clientX - gesture.current.startX),
        y: gesture.current.originY + (e.touches[0].clientY - gesture.current.startY),
      });
    }
  };
  const handleTouchEnd = () => {
    gesture.current.dragging = false;
    gesture.current.pinching = false;
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        style={{ cursor: 'zoom-in', ...style }}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {open && createPortal(
        <Modal
          onClose={close}
          overlayStyle={{ zIndex: 2000, background: 'rgba(0,0,0,0.92)' }}
          contentStyle={{
            background: 'transparent',
            boxShadow: 'none',
            border: 'none',
            padding: 0,
            maxWidth: '100vw',
            width: '100vw',
            maxHeight: '100vh',
            height: '100vh',
            borderRadius: 0,
            overflow: 'hidden',
          }}
          ariaLabel="عرض الصورة مكبرة"
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              touchAction: 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) {
                close();
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleTouchStart(e);
            }}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                if (scale === MIN_SCALE) {
                  close();
                }
              }}
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                cursor: scale > MIN_SCALE ? 'grab' : 'zoom-out',
                userSelect: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '10px',
                background: 'rgba(0,0,0,0.6)',
                padding: '8px 12px',
                borderRadius: '999px',
              }}
            >
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomOut(); }} style={zoomBtnStyle} aria-label="تصغير">
                −
              </button>
              <span style={{ color: '#fff', fontSize: '12px', minWidth: '40px', textAlign: 'center', alignSelf: 'center' }}>
                {Math.round(scale * 100)}%
              </span>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomIn(); }} style={zoomBtnStyle} aria-label="تكبير">
                +
              </button>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
              }}
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>
        </Modal>,
        document.body
      )}
    </>
  );
};

const zoomBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default ZoomableImage;

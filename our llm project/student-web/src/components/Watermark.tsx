import React, { useEffect, useState, useRef } from 'react';

interface WatermarkProps {
  text: string;
  active?: boolean;
  onTamper?: () => void;
}

export const Watermark: React.FC<WatermarkProps> = ({ text, active = true, onTamper }) => {
  const [position, setPosition] = useState({ x: 20, y: 40 });
  const [tamperKey, setTamperKey] = useState(0);
  const lastTriggerRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const [containerId] = useState(() => 'v-wm-c-' + Math.random().toString(36).substring(2, 9));
  const [textId] = useState(() => 'v-wm-t-' + Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    if (!active) return;

    const moveWatermark = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Restrict coordinate bounds so text stays visible inside the aspect ratio container
      const maxX = Math.max(10, width - 220);
      const maxY = Math.max(10, height - 60);

      const randomX = Math.random() * maxX;
      const randomY = Math.random() * maxY;

      setPosition({ x: randomX, y: randomY });
    };

    // Move immediately once, then every 5 seconds
    moveWatermark();
    const interval = setInterval(moveWatermark, 5000);

    window.addEventListener('resize', moveWatermark);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', moveWatermark);
    };
  }, [active, text, tamperKey]);

  // ── Anti-Tamper MutationObserver ──
  useEffect(() => {
    if (!active || !text) return;

    const handleViolation = () => {
      console.warn('[SECURITY] Watermark tampering detected!');
      if (onTamper) {
        onTamper();
      }
      
      const now = Date.now();
      if (now - lastTriggerRef.current > 1000) {
        lastTriggerRef.current = now;
        setTamperKey(prev => prev + 1);
      }
    };

    const targetContainer = containerRef.current;
    const targetWatermark = watermarkRef.current;
    if (!targetContainer || !targetWatermark) return;

    // Observe changes to attributes (style, class) or child list (deletion)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 1. If the watermark element itself or the container was removed
        if (mutation.type === 'childList') {
          const removedNodes = Array.from(mutation.removedNodes);
          if (removedNodes.includes(targetWatermark) || !document.body.contains(targetContainer)) {
            handleViolation();
            break;
          }
        }
        // 2. If style attributes were modified to hide the watermark
        if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          const style = window.getComputedStyle(targetWatermark);
          const containerStyle = window.getComputedStyle(targetContainer);

          // Comprehensive hiding detection — covers the common bypass techniques
          const isHidden =
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity || '1') < 0.05 ||
            parseInt(style.zIndex || '0', 10) < 5 ||
            style.pointerEvents !== 'none' ||
            // Element shrunk to invisibility
            parseFloat(style.fontSize || '10px') < 1 ||
            parseFloat(style.width || '100px') < 1 ||
            parseFloat(style.height || '20px') < 1 ||
            // Color made transparent to blend with background
            style.color === 'transparent' ||
            style.color === 'rgba(0, 0, 0, 0)' ||
            // transform / clip-path / translate used to move or clip the watermark out of view
            /scale\(0|scaleX\(0|scaleY\(0|translate|matrix/i.test(style.transform || '') ||
            (style.clipPath && style.clipPath !== 'none') ||
            // filter used to hide or blur the watermark
            /opacity\(0|blur/i.test(style.filter || '') ||
            /opacity\(0|blur/i.test(containerStyle.filter || '') ||
            containerStyle.display === 'none' ||
            containerStyle.visibility === 'hidden' ||
            parseFloat(containerStyle.opacity || '1') < 0.05;

          if (isHidden) {
            handleViolation();
            break;
          }
        }
      }
    });

    observer.observe(targetContainer, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });

    // Also observe the parent of the container to detect if the container itself is removed
    const parent = targetContainer.parentElement;
    if (parent) {
      observer.observe(parent, {
        childList: true
      });
    }

    return () => observer.disconnect();
  }, [active, text, onTamper, tamperKey]);

  if (!active || !text) return null;

  return (
    <div
      key={tamperKey}
      ref={containerRef}
      id={containerId}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      <div
        ref={watermarkRef}
        id={textId}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          color: 'rgba(255, 255, 255, 0.22)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 'bold',
          whiteSpace: 'pre-line',
          textAlign: 'center',
          fontFamily: 'Cairo, sans-serif',
          transition: 'top 0.6s ease-in-out, left 0.6s ease-in-out',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default Watermark;

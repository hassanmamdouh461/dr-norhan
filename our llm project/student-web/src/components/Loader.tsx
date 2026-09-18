import React from 'react';

interface LoaderProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  fullscreen?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({ 
  text = 'جاري التحميل', 
  size = 'medium',
  fullscreen = false 
}) => {
  const sizeMap = {
    small: { width: '40px', height: '40px', gap: '12px', fontSize: '0.85rem' },
    medium: { width: '64px', height: '64px', gap: '16px', fontSize: '0.95rem' },
    large: { width: '80px', height: '80px', gap: '20px', fontSize: '1.05rem' },
  };

  const currentSize = sizeMap[size] || sizeMap.medium;

  const containerStyle: React.CSSProperties = fullscreen ? {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: 'rgb(var(--background))',
    color: 'rgb(var(--on-background))',
    fontFamily: 'var(--font-arabic), Cairo, sans-serif',
    padding: '24px',
    boxSizing: 'border-box'
  } : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: currentSize.gap,
    width: '100%',
    height: '100%',
    fontFamily: 'var(--font-arabic), Cairo, sans-serif',
    padding: '16px',
    boxSizing: 'border-box'
  };

  return (
    <div style={containerStyle}>
      <div className="simple-loader-ring" style={{ width: currentSize.width, height: currentSize.height }}>
        <div></div>
      </div>
      {text && (
        <p className="loader-text" style={{ fontSize: currentSize.fontSize, margin: 0 }}>
          {text}
        </p>
      )}
    </div>
  );
};

export default Loader;

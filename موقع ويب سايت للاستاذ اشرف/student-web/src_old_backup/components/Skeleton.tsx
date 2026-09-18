import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

const SkeletonBase: React.FC<SkeletonProps> = ({ width = '100%', height = '16px', borderRadius = '8px', style }) => (
  <div
    className="skeleton-shimmer"
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, rgba(var(--on-surface), 0.06) 25%, rgba(var(--on-surface), 0.15) 50%, rgba(var(--on-surface), 0.06) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.5s ease-in-out infinite',
      ...style,
    }}
  />
);

/* ── Skeleton Card for Course Listings ── */
export const SkeletonCourseCard: React.FC = () => (
  <div
    className="card"
    style={{
      borderRadius: '16px',
      padding: 0,
      overflow: 'hidden',
      border: '1px solid rgba(var(--on-surface), 0.08)',
    }}
  >
    <SkeletonBase height="160px" borderRadius="0" />
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SkeletonBase width="80%" height="18px" />
      <SkeletonBase width="100%" height="12px" />
      <SkeletonBase width="60%" height="12px" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <SkeletonBase width="70px" height="32px" borderRadius="8px" />
        <SkeletonBase width="50px" height="12px" />
      </div>
    </div>
  </div>
);

/* ── Skeleton Grid (3 columns) ── */
export const SkeletonCourseGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid-3 gap-lg">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCourseCard key={i} />
    ))}
  </div>
);

/* ── Skeleton for Q&A Question Card ── */
export const SkeletonQuestionCard: React.FC = () => (
  <div
    className="card"
    style={{
      padding: '20px',
      borderRadius: '16px',
      border: '1px solid rgba(var(--on-surface), 0.08)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <SkeletonBase width="100px" height="14px" />
      <SkeletonBase width="80px" height="24px" borderRadius="20px" />
    </div>
    <SkeletonBase width="100%" height="14px" style={{ marginBottom: '8px' }} />
    <SkeletonBase width="90%" height="14px" style={{ marginBottom: '8px' }} />
    <SkeletonBase width="70%" height="14px" />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(var(--on-surface), 0.08)' }}>
      <SkeletonBase width="100px" height="28px" borderRadius="8px" />
      <SkeletonBase width="60px" height="14px" />
    </div>
  </div>
);

/* ── Skeleton for Exam Card ── */
export const SkeletonExamCard: React.FC = () => (
  <div
    className="card"
    style={{
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid rgba(var(--on-surface), 0.08)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <SkeletonBase width="100px" height="24px" borderRadius="6px" />
      <SkeletonBase width="80px" height="24px" borderRadius="6px" />
    </div>
    <SkeletonBase width="70%" height="18px" style={{ marginBottom: '8px' }} />
    <SkeletonBase width="50%" height="12px" style={{ marginBottom: '20px' }} />
    <SkeletonBase width="100%" height="40px" borderRadius="8px" />
  </div>
);

/* ── Skeleton Profile ── */
export const SkeletonProfile: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div
      className="card"
      style={{
        padding: '32px',
        borderRadius: '20px',
        border: '1px solid rgba(var(--on-surface), 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
      }}
    >
      <SkeletonBase width="110px" height="110px" borderRadius="50%" />
      <div style={{ flex: 1 }}>
        <SkeletonBase width="200px" height="22px" style={{ marginBottom: '8px' }} />
        <SkeletonBase width="150px" height="14px" style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBase width="80px" height="28px" borderRadius="20px" />
          <SkeletonBase width="80px" height="28px" borderRadius="20px" />
        </div>
      </div>
    </div>
  </div>
);

/* ── Skeleton List Item ── */
export const SkeletonListItem: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px',
      borderRadius: '10px',
      backgroundColor: 'rgba(var(--on-surface), 0.02)',
      border: '1px solid rgba(var(--on-surface), 0.04)',
    }}
  >
    <div style={{ flex: 1 }}>
      <SkeletonBase width="60%" height="14px" style={{ marginBottom: '4px' }} />
      <SkeletonBase width="40%" height="10px" />
    </div>
    <SkeletonBase width="60px" height="24px" borderRadius="6px" />
  </div>
);

/* ── Skeleton Sidebar Stats ── */
export const SkeletonSidebarStats: React.FC = () => (
  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(var(--on-surface), 0.03)' }}>
    <SkeletonBase width="80px" height="12px" style={{ marginBottom: '12px' }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <SkeletonListItem />
      <SkeletonListItem />
      <SkeletonListItem />
    </div>
  </div>
);

export default SkeletonBase;

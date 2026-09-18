/** Static premium platform footer (brand blurb + support contact + social links). */
export const Footer = () => {
  return (
    <footer
      style={{
        marginTop: '48px',
        paddingTop: '32px',
        paddingBottom: '20px',
        borderTop: '1px solid rgba(16, 185, 129, 0.12)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '24px',
        direction: 'rtl'
      }}
    >
      {/* Right Section: Brand & Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="icon" style={{ color: 'rgb(var(--primary))', fontSize: '24px' }}>school</span>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'rgb(var(--on-surface))', margin: 0, fontFamily: 'Cairo, sans-serif' }}>منصة فُصْحَى التعليمية</h3>
        </div>
        <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', lineHeight: '1.6', margin: 0 }}>
          منصة فُصْحَى للأستاذ أشرف سليم لشرح مادة اللغة العربية للثانوية العامة بأحدث الطرق التفاعلية والامتحانات الذكية.
        </p>
      </div>

      {/* Left Section: Socials & Support Contact */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>تواصل معنا للدعم والاستفسارات:</span>

        {/* Contact Actions Row */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* WhatsApp Button */}
          <a
            href="https://wa.me/201034324951"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(37, 211, 102, 0.08)',
              border: '1px solid rgba(37, 211, 102, 0.25)',
              padding: '8px 14px',
              borderRadius: '10px',
              color: 'rgb(var(--fusha-teal-400))',
              fontSize: '12px',
              fontWeight: 'bold',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.08)'}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-11.667c.131-.232.024-.564-.04-.695-.36-.738-.813-1.625-.92-1.841-.085-.17-.17-.17-.255-.17-.074-.002-.153-.002-.23-.002-.305 0-.712.11-.986.379-.275.269-1.05.992-1.05 2.42 0 1.427 1.05 2.806 1.196 2.996.147.19 2.012 3.109 4.954 4.316.699.287 1.245.459 1.67.591.703.22 1.344.189 1.85.114.565-.084 1.737-.696 1.984-1.371.247-.674.247-1.253.173-1.372-.074-.118-.272-.189-.57-.336-.297-.147-1.737-.83-2.009-.926-.272-.097-.47-.147-.668.147-.197.294-.766.926-.939 1.118-.173.193-.347.218-.644.07-.297-.148-1.253-.448-2.387-1.427-.883-.76-1.479-1.7-1.652-1.994-.173-.294-.018-.453.13-.6 l.462-.519c.148-.19.197-.294.297-.49z"/>
            </svg>
            <span>الواتساب: 01034324951</span>
          </a>

          {/* Call Support Button */}
          <a
            href="tel:01034324951"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '8px 14px',
              borderRadius: '10px',
              color: 'rgb(var(--primary))',
              fontSize: '12px',
              fontWeight: 'bold',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>call</span>
            <span>اتصال هاتفي</span>
          </a>
        </div>

        {/* Social Media Links Row */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
          {/* Facebook */}
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgb(var(--on-surface-variant))', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--fusha-teal-400))'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--on-surface-variant))'}
            title="فيسبوك"
          >
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgb(var(--on-surface-variant))', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--fusha-feedback-error))'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--on-surface-variant))'}
            title="يوتيوب"
          >
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>

          {/* Telegram */}
          <a
            href="https://telegram.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgb(var(--on-surface-variant))', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--fusha-feedback-info))'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--on-surface-variant))'}
            title="تليجرام"
          >
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
};

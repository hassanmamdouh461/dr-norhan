import{n as e}from"./rolldown-runtime-Bh1tDfsg.js";import{i as t,t as n}from"./vendor-react-CepXLKLB.js";import{f as r,l as i,r as ee,s as a,t as o,u as s}from"./index-CFg0zcFs.js";import{t as te}from"./img-BOCxzLZ5.js";import{t as ne}from"./ZoomableImage-CM0kH8gq.js";var c=e(t(),1),re=`/assets/teacher_portrait-DAJANz9D.webp`,l=n(),u=`القاهرة.الجيزة.الإسكندرية.القليوبية.الدقهلية.الشرقية.المنوفية.الغربية.البحيرة.دمياط.كفر الشيخ.الفيوم.بني سويف.المنيا.أسيوط.سوهاج.قنا.الأقصر.أسوان.البحر الأحمر.الوادي الجديد.مطروح.شمال سيناء.جنوب سيناء.السويس.الإسماعيلية.بورسعيد`.split(`.`),d=({onBrowseAsGuest:e})=>{let{theme:t}=o(),n=t===`dark`,{user:d,login:ie,register:ae,completeProfileSetup:oe,needsProfileSetup:f,error:se,clearError:p}=ee(),ce=n?`rgb(var(--fusha-teal-900))`:`rgb(var(--fusha-canvas-light))`,m=n?`#fff`:`rgb(var(--fusha-teal-900))`,h=n?`rgba(255, 255, 255, 0.05)`:`rgba(0, 0, 0, 0.08)`,le=n?`rgba(20, 21, 28, 0.45)`:`rgba(255, 255, 255, 0.85)`,g=n?`1px solid rgba(255, 255, 255, 0.06)`:`1px solid rgba(52, 211, 153, 0.15)`,_=n?`rgb(var(--fusha-sand-300))`:`rgb(var(--fusha-teal-500))`,ue=n?`rgba(255, 255, 255, 0.15)`:`rgba(52, 211, 153, 0.2)`,de=n?`transparent`:`rgb(var(--fusha-white))`,fe=n?`rgb(var(--fusha-white))`:`rgb(var(--fusha-teal-900))`,v=r(),[pe,me]=(0,c.useState)([]),[he,ge]=(0,c.useState)(!0),[_e,ve]=(0,c.useState)([]),[ye,be]=(0,c.useState)(!0),[y,xe]=(0,c.useState)(null),[b,Se]=(0,c.useState)(null),[x,S]=(0,c.useState)({}),[C,w]=(0,c.useState)(null),[Ce,we]=(0,c.useState)(!1),[T,Te]=(0,c.useState)(!1),[E,D]=(0,c.useState)(null),O=async e=>{we(!0),D(null),S({}),w(null),xe(e);try{Se(await a.getPublicExamDetails(e))}catch(e){D(e.message||`فشل تحميل بيانات الامتحان`)}finally{we(!1)}},k=()=>{xe(null),Se(null),S({}),w(null),D(null)},Ee=async()=>{if(y){Te(!0),D(null);try{w(await a.submitPublicExamAnswers(y,x))}catch(e){D(e.message||`فشل تسليم الامتحان`)}finally{Te(!1)}}};(0,c.useEffect)(()=>{(async()=>{try{let[e,t]=await Promise.all([a.getCourses(1),a.getPublicExams()]);e&&e.courses&&me(e.courses.slice(0,3)),t&&t.exams&&ve(t.exams.slice(0,4))}catch(e){console.error(`Failed to load showcase data:`,e)}finally{ge(!1),be(!1)}})()},[]);let A=e||(()=>v(`/dashboard/home`));(0,c.useEffect)(()=>{d&&!f&&v(`/dashboard/home`,{replace:!0})},[d,f,v]),(0,c.useEffect)(()=>(document.title=`تسجيل الدخول | فُصْحَى`,()=>{document.title=`فُصْحَى | منصة الأستاذ أشرف سليم - اللغة العربية للثانوية العامة`}),[]);let[De,j]=(0,c.useState)(!1),[Oe,ke]=(0,c.useState)(!1),[Ae,M]=(0,c.useState)(!1),[N,P]=(0,c.useState)(``),[je,Me]=(0,c.useState)(!1),[Ne,Pe]=(0,c.useState)(``),[Fe,Ie]=(0,c.useState)(!1),[Le,F]=(0,c.useState)(null),[I,L]=(0,c.useState)(!1),[R,Re]=(0,c.useState)(``),[z,ze]=(0,c.useState)(``),[B,Be]=(0,c.useState)(!1),[V,Ve]=(0,c.useState)(``),[H,He]=(0,c.useState)(``),[U,Ue]=(0,c.useState)(``),[W,We]=(0,c.useState)(``),[Ge,Ke]=(0,c.useState)(`ذكر`),[qe,Je]=(0,c.useState)([`الصف الأول الثانوي`,`الصف الثاني الثانوي`,`الصف الثالث الثانوي`,`طلاب الـ IG`]),[G,Ye]=(0,c.useState)([]),[K,q]=(0,c.useState)(`الصف الأول الثانوي`),[J,Y]=(0,c.useState)(`عام`),[X,Xe]=(0,c.useState)(`القاهرة`);(0,c.useEffect)(()=>{(async()=>{try{let e=await a.getPublicSettings();if(e){if(e.academic_years&&e.academic_years.length>0){Je(e.academic_years),q(e.academic_years[0]);let t=e.academic_years[0];Y((e.branches&&e.branches.length>0?e.branches:t===`الصف الأول الثانوي`?[`عام`,`أزهر`]:[`عام`,`أزهر`,`علمي`,`أدبي`])[0])}e.branches&&e.branches.length>0&&Ye(e.branches)}}catch(e){console.error(`Failed to load public settings in login page:`,e)}})()},[]);let[Z,Ze]=(0,c.useState)(``),[Qe,$e]=(0,c.useState)(!1),Q=e=>{let t=[];if(e.includes(`الأول`))t=[`عام`,`أزهر`];else if(e.includes(`الثاني`))t=[`عام`,`أزهر`,`علمي`,`أدبي`];else if(e.includes(`الثالث`))t=[`عام`,`أزهر`,`علمي علوم`,`علمي رياضة`,`أدبي`];else if(e.includes(`IG`)||e.toLowerCase().includes(`ig`))t=[`OL`,`AS`,`A-Level`,`علمي`,`أدبي`];else return G&&G.length>0?G:[`عام`];if(G&&G.length>0){let e=G.filter(e=>t.includes(e));return e.length>0?e:[`عام`]}return t},et=async e=>{e.preventDefault(),F(null),p(),L(!0);try{if(!R||!z)throw Error(`يرجى ملء جميع الحقول المطلوبة`);await ie(R,z)}catch(e){console.error(e),e.code===`DEVICE_LIMIT_EXCEEDED`||e.message&&e.message.includes(`الأجهزة`)?M(!0):F(e.message||`فشل تسجيل الدخول. يرجى مراجعة الحقول.`)}finally{L(!1)}},tt=async e=>{e.preventDefault(),F(null),p(),L(!0);try{if(!H||!U||!W||!z||!V)throw Error(`يرجى ملء جميع الحقول المطلوبة`);if(z!==V)throw Error(`كلمتا المرور غير متطابقتين`);if(U.length<10)throw Error(`رقم الهاتف غير صالح`);if(W.length<10)throw Error(`رقم هاتف ولي الأمر غير صالح`);await ae({phone:U,fullName:H,parentPhone:W,grade:K,branch:J,governorate:X,password:z})}catch(e){console.error(e),F(e.message||`فشل التسجيل. حاول مرة أخرى.`)}finally{L(!1)}},nt=async e=>{e.preventDefault(),F(null),p(),L(!0);try{if(!H||!U||!W)throw Error(`يرجى ملء جميع الحقول المطلوبة`);await oe({fullName:H,phone:U,parentPhone:W,grade:K,branch:J,governorate:X})}catch(e){console.error(e),F(e.message||`فشل إكمال إعداد الملف الشخصي.`)}finally{L(!1)}},rt=async e=>{e.preventDefault(),Ie(!0),Pe(``);try{if(N.trim().length<5)throw Error(`يرجى كتابة سبب صحيح (5 أحرف على الأقل)`);await a.submitDeviceResetRequest({device_id:i(),platform:`web`,model:navigator.userAgent.substring(0,50),reason:N}),Me(!0)}catch(e){console.error(e),Pe(e.message||`فشل إرسال طلب إعادة التعيين`)}finally{Ie(!1)}},it=async e=>{e.preventDefault(),L(!0);try{let e=/^[0-9]+$/.test(Z.trim())?`${Z.trim()}@fusha.edu.eg`:Z.trim(),{error:t}=await s.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin+`/reset-password`});if(t)throw t;$e(!0)}catch(e){console.error(e),F(e.message||`تعذر إرسال رابط استعادة كلمة المرور`)}finally{L(!1)}},at=e=>/^01[0125][0-9]{8}$/.test(e),ot=e=>/^01[0125][0-9]{8}$/.test(e)&&e!==U,st=e=>e.length>=6,ct=e=>e===z&&e.length>=6,lt=e=>e.trim().split(` `).filter(Boolean).length>=3,$=Le||se;return f?(0,l.jsx)(`div`,{className:`flex flex-col items-center justify-center min-h-screen p-md`,style:{direction:`rtl`},children:(0,l.jsxs)(`div`,{className:`card card-glass w-full`,style:{maxWidth:`500px`},children:[(0,l.jsx)(`h2`,{className:`title-medium text-center`,style:{marginBottom:`16px`,color:`rgb(var(--primary))`},children:`إكمال إعداد حساب الطالب`}),(0,l.jsx)(`p`,{className:`body-small text-center`,style:{marginBottom:`24px`},children:`يرجى ملء البيانات التالية لتفعيل حسابك على المنصة بنجاح.`}),$&&(0,l.jsx)(`div`,{className:`badge badge-danger w-full justify-center`,style:{padding:`12px`,marginBottom:`16px`},children:$}),(0,l.jsxs)(`form`,{onSubmit:nt,className:`flex flex-col`,children:[(0,l.jsxs)(`div`,{className:`form-group`,children:[(0,l.jsx)(`label`,{className:`form-label`,children:`الاسم بالكامل`}),(0,l.jsxs)(`div`,{className:`input-container`,children:[(0,l.jsx)(`input`,{type:`text`,className:`input-text`,placeholder:`أدخل اسمك الحقيقي بالكامل`,value:H,onChange:e=>He(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`icon input-icon-right`,children:`person`})]})]}),(0,l.jsxs)(`div`,{className:`form-group`,children:[(0,l.jsx)(`label`,{className:`form-label`,children:`رقم الهاتف (الخاص بك)`}),(0,l.jsxs)(`div`,{className:`input-container`,children:[(0,l.jsx)(`input`,{type:`tel`,className:`input-text`,placeholder:`رقم الموبايل الشخصي`,value:U,onChange:e=>Ue(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`icon input-icon-right`,children:`phone_iphone`})]})]}),(0,l.jsxs)(`div`,{className:`form-group`,children:[(0,l.jsx)(`label`,{className:`form-label`,children:`رقم هاتف ولي الأمر`}),(0,l.jsxs)(`div`,{className:`input-container`,children:[(0,l.jsx)(`input`,{type:`tel`,className:`input-text`,placeholder:`رقم موبايل ولي الأمر للطوارئ`,value:W,onChange:e=>We(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`icon input-icon-right`,children:`family_restroom`})]})]}),(0,l.jsxs)(`div`,{className:`grid-2 gap-md`,style:{marginBottom:`16px`},children:[(0,l.jsxs)(`div`,{className:`form-group`,children:[(0,l.jsx)(`label`,{className:`form-label`,children:`الصف الدراسي`}),(0,l.jsx)(`select`,{className:`select`,value:K,onChange:e=>{q(e.target.value),Y(Q(e.target.value)[0])},children:qe.map(e=>(0,l.jsx)(`option`,{value:e,children:e},e))})]}),(0,l.jsxs)(`div`,{className:`form-group`,children:[(0,l.jsx)(`label`,{className:`form-label`,children:`التخصص / الشعبة`}),(0,l.jsx)(`select`,{className:`select`,value:J,onChange:e=>Y(e.target.value),children:Q(K).map(e=>(0,l.jsx)(`option`,{value:e,children:e},e))})]})]}),(0,l.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`24px`},children:[(0,l.jsx)(`label`,{className:`form-label`,children:`المحافظة`}),(0,l.jsx)(`select`,{className:`select`,value:X,onChange:e=>Xe(e.target.value),children:u.map(e=>(0,l.jsx)(`option`,{value:e,children:e},e))})]}),(0,l.jsx)(`button`,{type:`submit`,className:`btn btn-primary w-full`,disabled:I,children:I?`جاري الحفظ...`:`حفظ وإكمال التسجيل`})]})]})}):(0,l.jsxs)(`div`,{className:`login-landing-container`,style:{minHeight:`100vh`,backgroundColor:ce,color:m,direction:`rtl`,overflowX:`hidden`},children:[(0,l.jsx)(`style`,{children:`
        /* ═══ Entrance choreography ═══ */
        .hero-reveal {
          opacity: 0;
          transform: translateY(20px);
          animation: heroReveal 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes heroReveal {
          to { opacity: 1; transform: none; }
        }

        /* ═══ Floating calligraphic words (code-drawn, theme-aware) ═══ */
        .hero-floating-words { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
        .hero-floating-words .fw {
          position: absolute;
          font-family: 'Amiri', 'Cairo', serif;
          font-weight: 700;
          color: var(--lh-word);
          animation: fwDrift 16s ease-in-out infinite alternate;
          user-select: none;
        }
        .fw-1 { top: 9%;  left: 6%;  font-size: 58px; animation-delay: 0s; }
        .fw-2 { top: 34%; left: 2%;  font-size: 40px; animation-delay: -4s; }
        .fw-3 { bottom: 22%; left: 10%; font-size: 66px; animation-delay: -8s; }
        .fw-4 { top: 6%;  right: 30%; font-size: 38px; animation-delay: -2s; }
        .fw-5 { bottom: 12%; right: 4%; font-size: 46px; animation-delay: -6s; }
        .fw-6 { top: 46%; left: 26%; font-size: 34px; animation-delay: -10s; }
        @keyframes fwDrift {
          from { transform: translateY(0) rotate(-2deg); }
          to   { transform: translateY(-22px) rotate(2deg); }
        }

        /* ═══ Display headline (Amiri manuscript voice) ═══ */
        .hero-display-title {
          font-family: 'Amiri', 'Cairo', serif;
          font-size: clamp(40px, 4.6vw, 64px);
          line-height: 1.35;
          font-weight: 700;
          margin: 0;
          color: var(--lh-ink);
        }
        .hero-display-title .em {
          background: linear-gradient(120deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 45%, var(--lh-gold) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hero-gold-divider {
          width: 150px;
          height: 3px;
          margin-top: 14px;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--lh-gold) 0%, rgba(52, 211, 153,0.7) 60%, transparent 100%);
          position: relative;
        }
        .hero-gold-divider::after {
          content: '';
          position: absolute;
          inset-inline-start: -10px;
          top: -2.5px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--lh-gold);
          box-shadow: 0 0 10px var(--lh-gold);
        }

        /* ═══ Teacher arch frame (manuscript arch) ═══ */
        .teacher-arch-frame {
          position: relative;
          width: clamp(225px, 20vw, 280px);
          padding: 9px;
          border-radius: 170px 170px 28px 28px;
          background: linear-gradient(165deg, var(--lh-gold-line) 0%, rgba(52, 211, 153,0.55) 45%, rgba(52, 211, 153,0.08) 100%);
          box-shadow: 0 30px 60px rgba(0,0,0,0.25);
        }
        .teacher-arch-inner {
          height: clamp(245px, 22vw, 305px);
          border-radius: 162px 162px 21px 21px;
          overflow: hidden;
          position: relative;
          background:
            radial-gradient(130% 90% at 50% 8%, rgba(52, 211, 153,0.4) 0%, transparent 55%),
            linear-gradient(180deg, var(--lh-arch-top) 0%, var(--lh-arch-bottom) 100%);
          border: 1px solid var(--lh-line);
        }
        .teacher-arch-inner img {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-44%);
          height: 104%;
          max-width: none;
          object-fit: contain;
          filter: drop-shadow(0 16px 28px rgba(0,0,0,0.4));
        }
        .teacher-arch-badge {
          position: absolute;
          bottom: -18px;
          right: 50%;
          transform: translateX(50%);
          white-space: nowrap;
          background: var(--lh-badge-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--lh-gold-line);
          color: var(--lh-ink);
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 12.5px;
          font-weight: 800;
          font-family: 'Cairo', sans-serif;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.3);
          z-index: 3;
        }
        .teacher-arch-badge .material-symbols-outlined { font-size: 17px; color: var(--lh-gold); }

        /* ═══ Auth card with emerald→gold hairline ═══ */
        .auth-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: var(--lh-card-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border-radius: 26px;
          padding: clamp(22px, 2.4vw, 32px) clamp(18px, 2.2vw, 30px);
          box-shadow: var(--lh-card-shadow);
        }
        .auth-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 26px;
          padding: 1.5px;
          background: linear-gradient(155deg,
            rgba(52, 211, 153,0.85) 0%,
            var(--lh-gold-line) 30%,
            rgba(52, 211, 153,0.12) 60%,
            var(--lh-gold-line) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* Segmented login/signup switcher */
        .auth-tabs {
          display: flex;
          gap: 4px;
          background: var(--lh-tabs-bg);
          border: 1px solid var(--lh-line);
          border-radius: 13px;
          padding: 4px;
          margin-bottom: 22px;
        }
        .auth-tabs button {
          flex: 1;
          height: 40px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--lh-ink-soft);
          font-family: 'Cairo', sans-serif;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .auth-tabs button.active {
          background: linear-gradient(135deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 100%);
          color: #fff;
          box-shadow: 0 6px 16px rgba(52, 211, 153,0.35);
        }
        .auth-card-heading {
          font-size: 22px;
          font-weight: 800;
          color: var(--lh-ink);
          text-align: right;
          margin: 0;
          font-family: 'Cairo', sans-serif;
        }
        .auth-card-subheading {
          font-size: 12.5px;
          color: var(--lh-ink-soft);
          text-align: right;
          margin: 4px 0 0 0;
          line-height: 1.7;
        }

        /* ═══ Form controls ═══ */
        .exact-hero-input {
          width: 100%;
          height: 48px;
          background: var(--lh-input-bg);
          border: 1px solid var(--lh-line);
          border-radius: 12px;
          color: var(--lh-ink);
          font-size: 14px;
          padding: 0 44px 0 44px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          text-align: right;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-input:focus {
          border-color: rgb(var(--fusha-teal-400));
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
          background: var(--lh-input-bg-focus);
          outline: none;
        }
        .exact-hero-input::placeholder { color: var(--lh-placeholder); }
        .exact-hero-select {
          width: 100%;
          height: 48px;
          background: var(--lh-input-bg);
          border: 1px solid var(--lh-line);
          border-radius: 12px;
          color: var(--lh-ink);
          font-size: 13.5px;
          padding: 0 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          text-align: right;
          cursor: pointer;
          appearance: none;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-select:focus {
          border-color: rgb(var(--fusha-teal-400));
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
          outline: none;
        }
        .exact-hero-label {
          font-size: 12.5px;
          color: var(--lh-ink-soft);
          font-weight: 700;
          margin-bottom: 7px;
          display: block;
          text-align: right;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-btn {
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 100%);
          color: rgb(var(--fusha-white));
          font-weight: 800;
          font-size: 15px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: 'Cairo', sans-serif;
          box-shadow: 0 10px 24px rgba(52, 211, 153, 0.35), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .exact-hero-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
          box-shadow: 0 14px 32px rgba(52, 211, 153, 0.45), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .exact-hero-btn:active { transform: translateY(0); }
        .exact-hero-btn:disabled {
          filter: grayscale(0.4) opacity(0.55);
          cursor: not-allowed;
          transform: none;
        }
        .exact-hero-link {
          font-size: 13px;
          color: var(--lh-ink-soft);
          cursor: pointer;
          transition: color 0.2s ease;
          text-decoration: none;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-link:hover { color: rgb(var(--fusha-teal-400)); }

        /* ═══ Bottom trust strip — anchors the empty viewport bottom ═══ */
        .hero-trust-strip {
          position: relative;
          z-index: 10;
          margin-top: auto;
          width: 100%;
          max-width: 1280px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          border-top: 1px solid var(--lh-line);
        }
        .hero-trust-items { display: flex; gap: 28px; flex-wrap: wrap; }
        .hero-trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--lh-ink-soft);
          font-size: 13px;
          font-weight: 700;
          font-family: 'Cairo', sans-serif;
        }
        .hero-trust-item .material-symbols-outlined { font-size: 18px; color: var(--lh-gold); }
        .hero-trust-socials { display: flex; gap: 16px; align-items: center; }
        .hero-trust-socials a { color: var(--lh-ink-soft); display: flex; transition: color 0.2s, transform 0.2s; }
        .hero-trust-socials a:hover { transform: translateY(-2px); }

        @keyframes phraseFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-reveal { animation: none; opacity: 1; transform: none; }
          .hero-floating-words .fw { animation: none; }
        }

        /* ═══ Mobile ═══ */
        @media (max-width: 1024px) {
          .hero-floating-words { display: none; }
          .exact-calligraphy-watermark {
            width: 100% !important;
            opacity: 0.1 !important;
            background-position: center !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
          }
          .login-hero-auth-wrapper {
            grid-template-columns: 1fr !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 40px !important;
            padding: 0 20px !important;
          }
          .login-hero-intro-column {
            align-items: center !important;
            text-align: center !important;
            width: 100% !important;
            gap: 28px !important;
          }
          .exact-branding-header {
            justify-content: center !important;
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
          }
          .exact-branding-header span {
            font-size: 13px !important;
            text-align: center !important;
            white-space: normal !important;
            line-height: 1.6 !important;
          }
          .exact-hero-title-container { text-align: center !important; width: 100% !important; }
          .hero-display-title { font-size: 40px !important; text-align: center !important; }
          .hero-gold-divider { margin-left: auto; margin-right: auto; }
          .exact-hero-subtitle-line { justify-content: center !important; flex-wrap: wrap; height: auto !important; }
          .exact-teacher-portrait-container { justify-content: center !important; width: 100% !important; display: flex !important; }
          .teacher-arch-frame { width: 240px; }
          .teacher-arch-inner { height: 262px; }
          .login-auth-form-column { width: 100% !important; display: flex !important; justify-content: center !important; }
          .hero-trust-strip { justify-content: center; text-align: center; }
        }
      `}),(0,l.jsxs)(`section`,{className:`login-hero-auth-section`,style:{position:`relative`,display:`flex`,flexDirection:`column`,alignItems:`center`,minHeight:`100vh`,overflow:`hidden`,padding:`clamp(28px, 5vh, 56px) 0 0 0`,borderBottom:n?`1px solid rgba(255, 255, 255, 0.05)`:`1px solid rgba(0, 0, 0, 0.05)`,background:n?`radial-gradient(1100px 700px at 80% 15%, rgb(var(--fusha-teal-800)) 0%, transparent 55%), radial-gradient(900px 600px at 10% 90%, rgba(220, 187, 109, 0.06) 0%, transparent 55%), linear-gradient(180deg, rgb(var(--fusha-teal-900)) 0%, rgb(var(--fusha-teal-900)) 100%)`:`radial-gradient(1100px 700px at 80% 15%, rgb(var(--fusha-sage-100)) 0%, transparent 55%), radial-gradient(900px 600px at 10% 90%, rgba(154, 123, 45, 0.08) 0%, transparent 55%), linear-gradient(180deg, rgb(var(--fusha-canvas-light)) 0%, rgb(var(--fusha-teal-50)) 100%)`,"--lh-ink":n?`rgb(var(--fusha-sand-50))`:`rgb(var(--fusha-teal-900))`,"--lh-ink-soft":n?`rgba(233, 242, 237, 0.65)`:`rgba(11, 31, 23, 0.65)`,"--lh-gold":n?`rgb(var(--fusha-gold-400))`:`rgb(var(--fusha-gold-700))`,"--lh-gold-line":n?`rgba(220, 187, 109, 0.45)`:`rgba(154, 123, 45, 0.4)`,"--lh-line":n?`rgba(255, 255, 255, 0.09)`:`rgba(11, 31, 23, 0.12)`,"--lh-word":n?`rgba(216, 234, 225, 0.07)`:`rgba(11, 63, 45, 0.08)`,"--lh-card-bg":n?`rgba(9, 17, 13, 0.74)`:`rgba(255, 255, 255, 0.86)`,"--lh-card-shadow":n?`0 40px 90px rgba(0, 0, 0, 0.55), 0 0 60px rgba(52, 211, 153, 0.10)`:`0 30px 60px rgba(13, 60, 44, 0.14), 0 0 40px rgba(52, 211, 153, 0.10)`,"--lh-input-bg":n?`rgba(5, 11, 8, 0.55)`:`rgba(255, 255, 255, 0.75)`,"--lh-input-bg-focus":n?`rgba(5, 11, 8, 0.9)`:`rgb(var(--fusha-white))`,"--lh-placeholder":n?`rgba(255, 255, 255, 0.3)`:`rgba(11, 31, 23, 0.35)`,"--lh-tabs-bg":n?`rgba(255, 255, 255, 0.04)`:`rgba(11, 31, 23, 0.05)`,"--lh-badge-bg":n?`rgba(7, 14, 10, 0.88)`:`rgba(255, 255, 255, 0.92)`,"--lh-arch-top":n?`rgb(var(--fusha-teal-800))`:`rgb(var(--fusha-teal-100))`,"--lh-arch-bottom":n?`rgb(var(--fusha-teal-900))`:`rgb(var(--fusha-sand-300))`},children:[(0,l.jsx)(`div`,{className:`exact-calligraphy-watermark`,style:{position:`absolute`,top:0,insetInlineStart:0,bottom:0,width:`55%`,backgroundImage:`var(--hero-bg-gradient)`,backgroundSize:`cover`,backgroundPosition:`center`,opacity:n?.16:.1,pointerEvents:`none`,mixBlendMode:n?`screen`:`multiply`,zIndex:0,WebkitMaskImage:`linear-gradient(to left, black 25%, transparent 90%)`,maskImage:`linear-gradient(to left, black 25%, transparent 90%)`}}),(0,l.jsxs)(`div`,{className:`hero-floating-words`,"aria-hidden":`true`,children:[(0,l.jsx)(`span`,{className:`fw fw-1`,children:`نحو`}),(0,l.jsx)(`span`,{className:`fw fw-2`,children:`صرف`}),(0,l.jsx)(`span`,{className:`fw fw-3`,children:`بلاغة`}),(0,l.jsx)(`span`,{className:`fw fw-4`,children:`أدب`}),(0,l.jsx)(`span`,{className:`fw fw-5`,children:`نص`}),(0,l.jsx)(`span`,{className:`fw fw-6`,children:`قراءة`})]}),(0,l.jsx)(`div`,{style:{position:`absolute`,top:`12%`,insetInlineEnd:`18%`,width:`340px`,height:`340px`,background:`radial-gradient(circle, rgba(55, 105, 92, 0.14) 0%, transparent 70%)`,borderRadius:`50%`,filter:`blur(70px)`,pointerEvents:`none`,zIndex:1}}),(0,l.jsx)(`div`,{style:{position:`absolute`,bottom:`8%`,insetInlineStart:`12%`,width:`300px`,height:`300px`,background:`radial-gradient(circle, ${n?`rgba(232, 181, 74, 0.10)`:`rgba(184, 132, 34, 0.12)`} 0%, transparent 70%)`,borderRadius:`50%`,filter:`blur(70px)`,pointerEvents:`none`,zIndex:1}}),(0,l.jsxs)(`div`,{className:`login-hero-auth-wrapper`,style:{zIndex:10,marginTop:`auto`,marginBottom:`auto`},children:[(0,l.jsxs)(`div`,{className:`login-hero-intro-column`,style:{display:`flex`,flexDirection:`column`,gap:`34px`,textAlign:`right`},children:[(0,l.jsxs)(`div`,{className:`exact-hero-title-container hero-reveal`,style:{animationDelay:`0.15s`},children:[(0,l.jsxs)(`h1`,{className:`hero-display-title`,children:[(0,l.jsx)(`span`,{style:{display:`block`},children:`منصتك الأولى لتعلم`}),(0,l.jsx)(`span`,{className:`em`,style:{display:`block`},children:`اللغة العربية`})]}),(0,l.jsx)(`div`,{className:`hero-gold-divider`,"aria-hidden":`true`})]}),(0,l.jsx)(`div`,{className:`exact-teacher-portrait-container hero-reveal`,style:{display:`flex`,justifyContent:`flex-start`,overflow:`visible`,animationDelay:`0.3s`,paddingBottom:`22px`},children:(0,l.jsxs)(`div`,{className:`teacher-arch-frame`,children:[(0,l.jsx)(`div`,{className:`teacher-arch-inner`,children:(0,l.jsx)(`img`,{src:re,alt:`الأستاذ أشرف سليم على منصة فُصْحَى`})}),(0,l.jsxs)(`div`,{className:`teacher-arch-badge`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,"aria-hidden":`true`,children:`verified`}),`فُصْحَى · أستاذ اللغة العربية`]})]})})]}),(0,l.jsx)(`div`,{className:`login-auth-form-column`,style:{display:`flex`,justifyContent:`center`,alignItems:`center`},children:(0,l.jsxs)(`div`,{className:`auth-card hero-reveal`,style:{animationDelay:`0.2s`},children:[$&&(0,l.jsx)(`div`,{style:{background:`rgba(239, 68, 68, 0.1)`,border:`1px solid rgba(239, 68, 68, 0.2)`,color:n?`rgb(var(--fusha-gold-500))`:`rgb(var(--fusha-gold-700))`,borderRadius:`10px`,padding:`12px`,fontSize:`13px`,textAlign:`center`,marginBottom:`20px`,fontWeight:`600`},children:$}),Oe?(0,l.jsxs)(`form`,{onSubmit:it,style:{display:`flex`,flexDirection:`column`,gap:`16px`},children:[(0,l.jsx)(`h2`,{className:`auth-card-heading`,children:`استعادة كلمة المرور`}),(0,l.jsx)(`p`,{className:`auth-card-subheading`,style:{margin:0},children:`أدخل رقم الموبايل أو بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.`}),Qe?(0,l.jsx)(`div`,{style:{background:`rgba(52, 211, 153, 0.1)`,border:`1px solid rgba(52, 211, 153, 0.2)`,color:`rgb(var(--fusha-teal-400))`,borderRadius:`10px`,padding:`12px`,fontSize:`13px`,textAlign:`center`,fontWeight:`600`},children:`تم إرسال رابط إعادة التعيين بنجاح. تفقد بريدك الإلكتروني.`}):(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`البريد أو رقم الهاتف`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`text`,className:`exact-hero-input`,placeholder:`أدخل بريدك الإلكتروني أو رقم الموبايل`,value:Z,onChange:e=>Ze(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`mail`})]})]}),(0,l.jsx)(`button`,{type:`submit`,className:`exact-hero-btn`,disabled:I||Qe,children:I?`جاري الإرسال...`:`إرسال الرابط`}),(0,l.jsx)(`button`,{type:`button`,className:`exact-hero-btn`,onClick:()=>ke(!1),style:{background:`transparent`,border:`1.5px solid var(--lh-line)`,color:`var(--lh-ink)`,boxShadow:`none`},children:`العودة لتسجيل الدخول`})]}):De?(0,l.jsxs)(`form`,{onSubmit:tt,style:{display:`flex`,flexDirection:`column`,gap:`14px`},children:[(0,l.jsxs)(`div`,{className:`auth-tabs`,role:`tablist`,"aria-label":`نوع الدخول`,children:[(0,l.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":`false`,onClick:()=>j(!1),children:`تسجيل الدخول`}),(0,l.jsx)(`button`,{type:`button`,className:`active`,role:`tab`,"aria-selected":`true`,children:`حساب جديد`}),(0,l.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":`false`,onClick:A,children:`استكشف المنصة`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`h2`,{className:`auth-card-heading`,children:`انضم لعائلة المنصة ✨`}),(0,l.jsx)(`p`,{className:`auth-card-subheading`,children:`دقيقة واحدة وتكون جاهزاً لأول محاضرة.`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`الاسم بالكامل`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`text`,className:`exact-hero-input`,placeholder:`الاسم ثلاثياً باللغة العربية`,value:H,onChange:e=>He(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`person`})]}),H&&!lt(H)&&(0,l.jsx)(`p`,{style:{color:n?`rgb(var(--fusha-gold-500))`:`rgb(var(--fusha-gold-700))`,fontSize:`11px`,marginTop:`4px`,textAlign:`right`,margin:0},children:`⚠️ يرجى إدخال اسمك ثلاثياً باللغة العربية على الأقل.`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`رقم الهاتف (الموبايل)`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`tel`,className:`exact-hero-input`,placeholder:`مثال: 01012345678`,value:U,onChange:e=>Ue(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`phone_iphone`})]}),U&&!at(U)&&(0,l.jsx)(`p`,{style:{color:n?`rgb(var(--fusha-gold-500))`:`rgb(var(--fusha-gold-700))`,fontSize:`11px`,marginTop:`4px`,textAlign:`right`,margin:0},children:`⚠️ رقم المحمول يجب أن يبدأ بـ 01 ويتكون من 11 رقماً.`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`رقم هاتف ولي الأمر`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`tel`,className:`exact-hero-input`,placeholder:`رقم ولي الأمر للطوارئ`,value:W,onChange:e=>We(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`family_restroom`})]}),W&&!ot(W)&&(0,l.jsx)(`p`,{style:{color:n?`rgb(var(--fusha-gold-500))`:`rgb(var(--fusha-gold-700))`,fontSize:`11px`,marginTop:`4px`,textAlign:`right`,margin:0},children:`⚠️ يجب أن يكون رقماً صحيحاً ومختلفاً عن رقم هاتفك.`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`كلمة المرور`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`password`,className:`exact-hero-input`,placeholder:`6 رموز على الأقل`,value:z,onChange:e=>ze(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`lock`})]})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`تأكيد كلمة المرور`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`password`,className:`exact-hero-input`,placeholder:`أعد كتابة كلمة المرور`,value:V,onChange:e=>Ve(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`lock`})]})]}),(0,l.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`10px`},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`الصف الدراسي`}),(0,l.jsx)(`select`,{className:`exact-hero-select`,value:K,onChange:e=>{q(e.target.value),Y(Q(e.target.value)[0])},children:qe.map(e=>(0,l.jsx)(`option`,{value:e,style:{color:`rgb(var(--fusha-teal-900))`,backgroundColor:`rgb(var(--fusha-white))`},children:e},e))})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`التخصص`}),(0,l.jsx)(`select`,{className:`exact-hero-select`,value:J,onChange:e=>Y(e.target.value),children:Q(K).map(e=>(0,l.jsx)(`option`,{value:e,style:{color:`rgb(var(--fusha-teal-900))`,backgroundColor:`rgb(var(--fusha-white))`},children:e},e))})]})]}),(0,l.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`10px`},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`النوع`}),(0,l.jsxs)(`select`,{className:`exact-hero-select`,value:Ge,onChange:e=>Ke(e.target.value),children:[(0,l.jsx)(`option`,{value:`ذكر`,style:{color:`rgb(var(--fusha-teal-900))`,backgroundColor:`rgb(var(--fusha-white))`},children:`ذكر`}),(0,l.jsx)(`option`,{value:`أنثى`,style:{color:`rgb(var(--fusha-teal-900))`,backgroundColor:`rgb(var(--fusha-white))`},children:`أنثى`})]})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`المحافظة`}),(0,l.jsx)(`select`,{className:`exact-hero-select`,value:X,onChange:e=>Xe(e.target.value),children:u.map(e=>(0,l.jsx)(`option`,{value:e,style:{color:`rgb(var(--fusha-teal-900))`,backgroundColor:`rgb(var(--fusha-white))`},children:e},e))})]})]}),(0,l.jsx)(`button`,{type:`submit`,className:`exact-hero-btn`,disabled:I||!lt(H)||!at(U)||!ot(W)||!st(z)||!ct(V),style:{marginTop:`6px`},children:I?`جاري إنشاء الحساب...`:`إنشاء حساب جديد`}),(0,l.jsx)(`div`,{style:{borderTop:`1px solid var(--lh-line)`,paddingTop:`10px`,display:`flex`,justifyContent:`center`},children:(0,l.jsxs)(`span`,{onClick:A,style:{fontSize:`13px`,color:`rgb(var(--fusha-teal-400))`,fontWeight:`bold`,cursor:`pointer`,display:`flex`,alignItems:`center`,gap:`4px`},children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`16px`},children:`explore`}),`استكشف المنصة`]})})]}):(0,l.jsxs)(`form`,{onSubmit:et,style:{display:`flex`,flexDirection:`column`,gap:`18px`},children:[(0,l.jsxs)(`div`,{className:`auth-tabs`,role:`tablist`,"aria-label":`نوع الدخول`,children:[(0,l.jsx)(`button`,{type:`button`,className:`active`,role:`tab`,"aria-selected":`true`,children:`تسجيل الدخول`}),(0,l.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":`false`,onClick:()=>j(!0),children:`حساب جديد`}),(0,l.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":`false`,onClick:A,children:`استكشف المنصة`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`h2`,{className:`auth-card-heading`,children:`أهلاً بعودتك! 👋`}),(0,l.jsx)(`p`,{className:`auth-card-subheading`,children:`سجّل دخولك وكمّل رحلتك نحو الدرجة النهائية.`})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`رقم الهاتف أو البريد`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:`text`,className:`exact-hero-input`,placeholder:`رقم الهاتف أو البريد`,value:R,onChange:e=>Re(e.target.value),required:!0}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`person`})]})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{className:`exact-hero-label`,children:`كلمة المرور`}),(0,l.jsxs)(`div`,{style:{position:`relative`},children:[(0,l.jsx)(`input`,{type:B?`text`:`password`,className:`exact-hero-input`,placeholder:`••••••••`,value:z,onChange:e=>ze(e.target.value),required:!0,style:{paddingLeft:`42px`,paddingRight:`42px`}}),(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`var(--lh-ink-soft)`,fontSize:`18px`,pointerEvents:`none`},children:`lock`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>Be(!B),style:{position:`absolute`,right:`12px`,top:`50%`,transform:`translateY(-50%)`,background:`none`,border:`none`,padding:0,cursor:`pointer`,display:`flex`,alignItems:`center`,justifyContent:`center`},children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{color:`var(--lh-ink-soft)`,fontSize:`18px`},children:B?`visibility`:`visibility_off`})})]})]}),(0,l.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`14px`,marginTop:`4px`},children:[(0,l.jsx)(`button`,{type:`submit`,className:`exact-hero-btn`,disabled:I,children:I?`جاري تسجيل الدخول...`:`تسجيل الدخول`}),(0,l.jsx)(`div`,{style:{display:`flex`,justifyContent:`flex-start`},children:(0,l.jsx)(`span`,{onClick:()=>ke(!0),className:`exact-hero-link`,children:`نسيت كلمة المرور؟`})})]}),(0,l.jsx)(`div`,{style:{borderTop:`1px solid var(--lh-line)`,paddingTop:`16px`,display:`flex`,justifyContent:`center`},children:(0,l.jsxs)(`span`,{onClick:A,style:{fontSize:`13px`,color:`rgb(var(--fusha-teal-400))`,fontWeight:`bold`,cursor:`pointer`,display:`flex`,alignItems:`center`,gap:`4px`},children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`16px`},children:`explore`}),`استكشف المنصة`]})})]})]})})]}),(0,l.jsxs)(`div`,{className:`hero-trust-strip hero-reveal`,style:{animationDelay:`0.45s`},children:[(0,l.jsxs)(`div`,{className:`hero-trust-items`,children:[(0,l.jsxs)(`div`,{className:`hero-trust-item`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,"aria-hidden":`true`,children:`menu_book`}),`منهج الثانوية العامة كاملاً`]}),(0,l.jsxs)(`div`,{className:`hero-trust-item`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,"aria-hidden":`true`,children:`quiz`}),`امتحانات بتصحيح فوري`]}),(0,l.jsxs)(`div`,{className:`hero-trust-item`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,"aria-hidden":`true`,children:`forum`}),`دعم مباشر من فريق المنصة`]})]}),(0,l.jsxs)(`div`,{className:`hero-trust-socials`,children:[(0,l.jsx)(`a`,{href:`https://facebook.com`,target:`_blank`,rel:`noopener noreferrer`,"aria-label":`صفحتنا على فيسبوك`,title:`فيسبوك`,children:(0,l.jsx)(`svg`,{width:`18`,height:`18`,fill:`currentColor`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:(0,l.jsx)(`path`,{d:`M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z`})})}),(0,l.jsx)(`a`,{href:`https://youtube.com`,target:`_blank`,rel:`noopener noreferrer`,"aria-label":`قناتنا على يوتيوب`,title:`يوتيوب`,children:(0,l.jsx)(`svg`,{width:`18`,height:`18`,fill:`currentColor`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:(0,l.jsx)(`path`,{d:`M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z`})})}),(0,l.jsx)(`a`,{href:`https://telegram.org`,target:`_blank`,rel:`noopener noreferrer`,"aria-label":`قناتنا على تليجرام`,title:`تليجرام`,children:(0,l.jsx)(`svg`,{width:`18`,height:`18`,fill:`currentColor`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:(0,l.jsx)(`path`,{d:`M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z`})})})]})]})]}),(0,l.jsxs)(`section`,{className:`login-teacher-surround-section`,style:{backgroundColor:n?`rgb(var(--fusha-teal-900))`:`rgb(var(--fusha-white))`,borderBottom:`1px solid ${h}`},children:[(0,l.jsxs)(`div`,{style:{textAlign:`center`,marginBottom:`60px`,padding:`0 24px`},children:[(0,l.jsx)(`span`,{style:{fontSize:`12px`,color:`rgb(var(--primary))`,fontWeight:`900`,textTransform:`uppercase`,letterSpacing:`1px`},children:`مزايا المنصة الأكاديمية`}),(0,l.jsx)(`h2`,{style:{fontSize:`32px`,fontWeight:`900`,marginTop:`8px`,color:m,fontFamily:`Cairo, sans-serif`},children:`منظومة تعليمية متطورة لضمان التفوق`}),(0,l.jsx)(`p`,{style:{fontSize:`15px`,color:_,marginTop:`8px`,maxWidth:`600px`,marginLeft:`auto`,marginRight:`auto`},children:`كافة الأدوات والحلول التكنولوجية الذكية لتبسيط فهم لغتك العربية وبناء مهارات لغوية حقيقية.`})]}),(0,l.jsxs)(`div`,{className:`login-teacher-surround-wrapper`,children:[(0,l.jsxs)(`div`,{className:`login-surround-column`,children:[(0,l.jsxs)(`div`,{className:`login-surround-card card-gold`,children:[(0,l.jsx)(`div`,{className:`login-surround-card-icon`,children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,children:`menu_book`})}),(0,l.jsxs)(`div`,{className:`login-surround-card-details`,children:[(0,l.jsx)(`h3`,{className:`login-surround-card-title`,style:{color:m},children:`منهج كامل وشرح وافي`}),(0,l.jsx)(`p`,{className:`login-surround-card-desc`,style:{color:_},children:`شرح تفصيلي ومبسط يعتمد على بناء المفاهيم اللغوية خطوة بخطوة بطرق مبتكرة تضمن الفهم الكامل.`})]})]}),(0,l.jsxs)(`div`,{className:`login-surround-card card-teal`,children:[(0,l.jsx)(`div`,{className:`login-surround-card-icon`,children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,children:`assignment_turned_in`})}),(0,l.jsxs)(`div`,{className:`login-surround-card-details`,children:[(0,l.jsx)(`h3`,{className:`login-surround-card-title`,style:{color:m},children:`تدريبات وامتحانات دورية`}),(0,l.jsx)(`p`,{className:`login-surround-card-desc`,style:{color:_},children:`اختبارات وتدريبات تفاعلية عقب كل محاضرة لقياس استيعابك وتحديد نقاط قوتك وضعفك مباشرة.`})]})]})]}),(0,l.jsxs)(`div`,{className:`login-teacher-center-column`,children:[(0,l.jsx)(`div`,{className:`login-teacher-portal-glow`}),(0,l.jsx)(`div`,{className:`login-teacher-portal-ring`,children:(0,l.jsx)(`div`,{className:`login-teacher-portal-inner`,children:(0,l.jsx)(`img`,{src:re,alt:`فُصْحَى`})})})]}),(0,l.jsxs)(`div`,{className:`login-surround-column`,children:[(0,l.jsxs)(`div`,{className:`login-surround-card card-purple`,children:[(0,l.jsx)(`div`,{className:`login-surround-card-icon`,children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,children:`schema`})}),(0,l.jsxs)(`div`,{className:`login-surround-card-details`,children:[(0,l.jsx)(`h3`,{className:`login-surround-card-title`,style:{color:m},children:`ملخصات وخرائط ذهنية`}),(0,l.jsx)(`p`,{className:`login-surround-card-desc`,style:{color:_},children:`كتيبات ملخصة وخرائط ذهنية ذكية لتسهيل الحفظ السريع واسترجاع المعلومات ليلة الامتحان.`})]})]}),(0,l.jsxs)(`div`,{className:`login-surround-card card-rose`,children:[(0,l.jsx)(`div`,{className:`login-surround-card-icon`,children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,children:`supervised_user_circle`})}),(0,l.jsxs)(`div`,{className:`login-surround-card-details`,children:[(0,l.jsx)(`h3`,{className:`login-surround-card-title`,style:{color:m},children:`متابعة أولياء الأمور`}),(0,l.jsx)(`p`,{className:`login-surround-card-desc`,style:{color:_},children:`تقارير دورية ومباشرة تصل لولي الأمر بخصوص مستويات الطالب الأكاديمية وحضوره ودرجاته أولاً بأول.`})]})]})]})]})]}),(0,l.jsx)(`section`,{className:`login-free-content-section`,style:{backgroundColor:n?`rgb(var(--fusha-teal-900))`:`rgb(var(--fusha-canvas-light))`},children:(0,l.jsxs)(`div`,{className:`login-section-container`,children:[(0,l.jsx)(`div`,{className:`login-section-header`,style:{textAlign:`center`,marginBottom:`48px`},children:(0,l.jsx)(`h2`,{style:{fontSize:`32px`,fontWeight:`900`,marginTop:`8px`,color:m,fontFamily:`Cairo, sans-serif`},children:`المحاضرات المتاحة دون الاشتراك`})}),he?(0,l.jsx)(`div`,{style:{display:`flex`,gap:`24px`,flexWrap:`wrap`,justifyContent:`center`},children:[1,2,3].map(e=>(0,l.jsx)(`div`,{style:{width:`320px`,height:`220px`,borderRadius:`16px`,background:n?`rgba(255,255,255,0.03)`:`rgba(0,0,0,0.03)`,border:g},className:`skeleton-shimmer`},e))}):pe.length>0?(0,l.jsx)(`div`,{className:`login-courses-grid`,children:pe.map(e=>(0,l.jsxs)(`div`,{className:`login-course-card`,onClick:()=>v(`/courses/${e.id}`),style:{border:g,background:le},children:[(0,l.jsx)(`img`,{src:te(e.cover_image,400)||`https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80`,alt:e.title,loading:`lazy`,width:400,height:110,className:`login-course-cover`}),(0,l.jsxs)(`div`,{className:`login-course-content`,children:[(0,l.jsx)(`h4`,{className:`login-course-title`,style:{color:m},children:e.title}),(0,l.jsx)(`span`,{style:{fontSize:`11px`,color:`rgb(var(--primary))`,fontWeight:`800`,marginTop:`4px`},children:e.grade}),(0,l.jsxs)(`div`,{className:`login-course-meta`,children:[(0,l.jsxs)(`span`,{children:[e.lessons_count||0,` درس`]}),(0,l.jsx)(`span`,{className:`login-course-btn`,children:`تصفح مجاناً`})]})]})]},e.id))}):(0,l.jsx)(`div`,{style:{padding:`36px`,textAlign:`center`,background:n?`rgba(255,255,255,0.02)`:`rgba(0,0,0,0.02)`,borderRadius:`16px`,border:g,maxWidth:`500px`,marginLeft:`auto`,marginRight:`auto`},children:(0,l.jsx)(`p`,{style:{fontSize:`14px`,color:_,margin:0},children:`متاح تصفح المنصة كزائر لاستكشاف الملازم والمحاضرات.`})}),(0,l.jsxs)(`div`,{className:`login-section-header`,style:{textAlign:`center`,marginTop:`64px`,marginBottom:`32px`},children:[(0,l.jsx)(`h2`,{style:{fontSize:`28px`,fontWeight:`900`,color:m,fontFamily:`Cairo, sans-serif`},children:`الامتحانات التجريبية والمجانية`}),(0,l.jsx)(`p`,{style:{fontSize:`14px`,color:_,marginTop:`6px`},children:`اختبر مستواك فوراً وبدون تسجيل دخول في الامتحانات التفاعلية المجانية`})]}),ye?(0,l.jsx)(`div`,{style:{display:`flex`,gap:`20px`,flexWrap:`wrap`,justifyContent:`center`},children:[1,2].map(e=>(0,l.jsx)(`div`,{style:{width:`380px`,height:`140px`,borderRadius:`16px`,background:n?`rgba(255,255,255,0.03)`:`rgba(0,0,0,0.03)`,border:g},className:`skeleton-shimmer`},e))}):_e.length>0?(0,l.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fill, minmax(300px, 1fr))`,gap:`20px`,width:`100%`,maxWidth:`1100px`,margin:`0 auto`},children:_e.map(e=>(0,l.jsxs)(`div`,{onClick:()=>O(e.id),style:{border:g,background:le,borderRadius:`16px`,cursor:`pointer`,display:`flex`,flexDirection:`column`,overflow:`hidden`,transition:`transform 0.2s, box-shadow 0.2s`,textAlign:`right`},className:`login-course-card`,children:[(0,l.jsx)(`img`,{src:te(e.cover_image,400)||`https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80`,alt:e.title,loading:`lazy`,width:400,height:140,style:{width:`100%`,height:`140px`,objectFit:`cover`}}),(0,l.jsxs)(`div`,{style:{padding:`16px`,flex:1,display:`flex`,flexDirection:`column`,justifyContent:`space-between`},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`div`,{style:{display:`inline-block`,background:`rgba(52, 211, 153, 0.1)`,color:`rgb(var(--primary))`,fontSize:`11px`,fontWeight:`900`,padding:`2px 8px`,borderRadius:`4px`,marginBottom:`8px`},children:`امتحان مجاني`}),(0,l.jsx)(`h4`,{style:{fontSize:`15px`,fontWeight:`800`,color:m,margin:0,lineHeight:`1.4`},children:e.title}),(0,l.jsxs)(`p`,{style:{fontSize:`11px`,color:_,marginTop:`4px`,margin:0},children:[`المقرر: `,e.course_title]})]}),(0,l.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginTop:`16px`,paddingTop:`12px`,borderTop:n?`1px solid rgba(255,255,255,0.05)`:`1px solid rgba(0,0,0,0.05)`},children:[(0,l.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,fontSize:`11px`,color:_},children:[(0,l.jsxs)(`span`,{className:`flex items-center gap-0.5`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`13px`},children:`grade`}),e.max_score,` درجة`]}),e.time_limit_mins&&(0,l.jsxs)(`span`,{className:`flex items-center gap-0.5`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`13px`},children:`timer`}),e.time_limit_mins,` دقيقة`]})]}),(0,l.jsxs)(`span`,{style:{fontSize:`11px`,color:`rgb(var(--primary))`,fontWeight:`800`,display:`flex`,alignItems:`center`,gap:`2px`},children:[`ابدأ الحل`,(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`14px`,transform:`rotate(180deg)`},children:`arrow_right_alt`})]})]})]})]},e.id))}):(0,l.jsx)(`div`,{style:{padding:`36px`,textAlign:`center`,background:n?`rgba(255,255,255,0.02)`:`rgba(0,0,0,0.02)`,borderRadius:`16px`,border:g,maxWidth:`500px`,margin:`0 auto`},children:(0,l.jsx)(`p`,{style:{fontSize:`14px`,color:_,margin:0},children:`لا توجد امتحانات تجريبية مجانية متاحة حالياً.`})}),(0,l.jsxs)(`div`,{className:`login-dashboard-redirect`,children:[(0,l.jsxs)(`button`,{className:`login-dashboard-cta-btn`,onClick:()=>v(`/dashboard/home`),children:[(0,l.jsx)(`span`,{children:`انتقل إلى لوحة التحكم واستكشف المنصة`}),(0,l.jsx)(`span`,{className:`icon material-symbols-outlined`,style:{transform:`rotate(180deg)`,marginRight:`4px`},children:`arrow_forward`})]}),(0,l.jsx)(`p`,{style:{fontSize:`13px`,color:_,marginTop:`8px`},children:`أو تصفح المقررات، الملازم، وجداول الامتحانات كزائر غير مسجل`})]})]})}),(0,l.jsx)(`footer`,{className:`login-premium-footer`,style:{borderTop:`1px solid ${h}`,backgroundColor:n?`rgb(var(--fusha-teal-900))`:`rgb(var(--fusha-teal-50))`},children:(0,l.jsxs)(`div`,{className:`login-section-container`,style:{display:`flex`,flexDirection:`column`,alignItems:`center`,gap:`16px`},children:[(0,l.jsxs)(`span`,{style:{fontSize:`13.5px`,color:_,fontWeight:`700`},children:[`حقوق النشر والتشغيل محفوظة لـ`,` `,(0,l.jsx)(`span`,{style:{color:`rgb(var(--primary))`,fontWeight:`bold`},children:`منصة فُصْحَى`})]}),(0,l.jsxs)(`div`,{style:{display:`flex`,gap:`20px`,flexWrap:`wrap`,justifyContent:`center`,alignItems:`center`},children:[(0,l.jsx)(`a`,{href:`/files/apk`,style:{fontSize:`13.5px`,color:`rgb(var(--primary))`,textDecoration:`none`,fontWeight:`bold`},children:`تحميل منصة الطالب (APK)`}),(0,l.jsx)(`span`,{style:{color:h},children:`|`}),(0,l.jsx)(`span`,{style:{fontSize:`13.5px`,color:_},children:`شريكك الأقوى للدرجة النهائية في اللغة العربية`})]})]})}),Ae&&(0,l.jsx)(`div`,{className:`modal-overlay`,children:(0,l.jsxs)(`div`,{className:`modal-content`,style:{padding:`24px`,direction:`rtl`,backgroundColor:n?`rgb(var(--surface-container-high))`:`rgb(var(--fusha-white))`,border:g,color:m},children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-md`,style:{marginBottom:`16px`},children:[(0,l.jsx)(`span`,{className:`icon`,style:{fontSize:`32px`,color:`rgb(var(--error))`},children:`lock`}),(0,l.jsx)(`h3`,{className:`title-small`,style:{margin:0,color:m},children:`تجاوز حد الأجهزة المسموح بها`})]}),je?(0,l.jsxs)(`div`,{className:`flex flex-col items-center`,children:[(0,l.jsx)(`div`,{className:`badge badge-success w-full justify-center`,style:{padding:`12px`,marginBottom:`20px`},children:`تم تقديم طلب إعادة تعيين الأجهزة بنجاح.`}),(0,l.jsx)(`p`,{className:`body-small text-center`,style:{marginBottom:`20px`,color:_},children:`طلبك قيد المراجعة حالياً من قِبل الأستاذ أو المساعدين. سيتم فك ارتباط الأجهزة السابقة قريباً لتتمكن من تشغيل حسابك من هذا المتصفح.`}),(0,l.jsx)(`button`,{className:`btn btn-primary w-full`,onClick:()=>{M(!1),Me(!1),P(``)},children:`حسناً`})]}):(0,l.jsxs)(`form`,{onSubmit:rt,children:[(0,l.jsx)(`p`,{className:`body-small`,style:{marginBottom:`16px`,lineHeight:`1.6`,color:_},children:`لقد سجلت الدخول مسبقاً من عدد الأجهزة/المتصفحات المسموح به لحسابك. لفك ارتباط الأجهزة السابقة واستخدام حسابك على هذا المتصفح الجديد، يرجى كتابة سبب التغيير لتقديمه للإدارة:`}),(0,l.jsx)(`div`,{className:`form-group`,style:{marginBottom:`20px`},children:(0,l.jsx)(`textarea`,{className:`input-text`,style:{height:`80px`,paddingRight:`16px`,resize:`none`,backgroundColor:de,color:fe,borderColor:ue},placeholder:`مثال: قمت بتغيير المتصفح الخاص بي / مسحت الكاش بالخطأ...`,value:N,onChange:e=>P(e.target.value),required:!0})}),Ne&&(0,l.jsx)(`p`,{role:`alert`,style:{fontSize:`12px`,color:`rgb(var(--error))`,marginBottom:`16px`,fontWeight:`bold`},children:Ne}),(0,l.jsxs)(`div`,{className:`flex gap-md`,children:[(0,l.jsx)(`button`,{type:`submit`,className:`btn btn-primary flex-1`,disabled:Fe,children:Fe?`جاري الإرسال...`:`تقديم طلب التعيين`}),(0,l.jsx)(`button`,{type:`button`,className:`btn btn-secondary`,onClick:()=>{M(!1),P(``)},style:{backgroundColor:n?`rgba(255,255,255,0.08)`:`rgba(0,0,0,0.06)`,color:m,border:`none`},children:`إلغاء`})]})]})]})}),y&&(0,l.jsx)(`div`,{className:`modal-overlay`,style:{zIndex:1e3,display:`flex`,alignItems:`center`,justifyContent:`center`,padding:`16px`},children:(0,l.jsxs)(`div`,{className:`modal-content`,style:{maxWidth:`800px`,width:`100%`,maxHeight:`90vh`,overflowY:`auto`,borderRadius:`24px`,padding:`28px`,direction:`rtl`,backgroundColor:n?`rgb(var(--surface-container-high))`:`rgb(var(--fusha-white))`,border:g,color:m,boxShadow:`0 20px 50px rgba(0,0,0,0.3)`,position:`relative`},children:[(0,l.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,borderBottom:n?`1px solid rgba(255,255,255,0.08)`:`1px solid rgba(0,0,0,0.08)`,paddingBottom:`16px`,marginBottom:`20px`},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`span`,{style:{fontSize:`11px`,color:`rgb(var(--primary))`,fontWeight:`900`,textTransform:`uppercase`},children:`امتحان تجريبي مجاني`}),(0,l.jsx)(`h3`,{style:{fontSize:`20px`,fontWeight:`900`,margin:`4px 0 0 0`,color:m},children:b?.exam?.title||`جاري تحميل الامتحان...`})]}),(0,l.jsx)(`button`,{onClick:k,style:{background:`none`,border:`none`,color:_,cursor:`pointer`,display:`flex`,alignItems:`center`,justifyContent:`center`,padding:`8px`,borderRadius:`50%`,backgroundColor:n?`rgba(255,255,255,0.03)`:`rgba(0,0,0,0.03)`},children:(0,l.jsx)(`span`,{className:`material-symbols-outlined`,children:`close`})})]}),Ce?(0,l.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,alignItems:`center`,padding:`64px 0`,gap:`16px`},children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined animate-spin text-primary`,style:{fontSize:`48px`,color:`rgb(var(--primary))`},children:`sync`}),(0,l.jsx)(`p`,{style:{fontSize:`14px`,color:_,margin:0},children:`جاري تحميل أسئلة الامتحان...`})]}):E?(0,l.jsxs)(`div`,{style:{textAlign:`center`,padding:`32px 0`},children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`48px`,color:`rgb(var(--error))`,marginBottom:`12px`},children:`error`}),(0,l.jsx)(`p`,{style:{fontSize:`14.5px`,color:m,fontWeight:`700`},children:E}),(0,l.jsx)(`button`,{className:`btn btn-primary`,onClick:k,style:{marginTop:`16px`},children:`حسناً`})]}):C?(0,l.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`20px`},children:[(0,l.jsxs)(`div`,{style:{textAlign:`center`,padding:`24px`,borderRadius:`16px`,background:`rgba(52, 211, 153, 0.08)`,border:`1px solid rgba(52, 211, 153, 0.2)`,marginBottom:`24px`},children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`48px`,color:`rgb(var(--primary))`,marginBottom:`8px`},children:`check_circle`}),(0,l.jsx)(`h4`,{style:{fontSize:`18px`,fontWeight:`900`,margin:`0 0 8px 0`,color:m},children:`اكتمل تسليم محاولتك بنجاح!`}),(0,l.jsxs)(`div`,{style:{fontSize:`24px`,fontWeight:`900`,color:`rgb(var(--primary))`},children:[`درجتك: `,C.score,` / `,C.max_score]}),(0,l.jsx)(`p`,{style:{fontSize:`13px`,color:_,marginTop:`8px`,margin:0},children:`مراجعة تفصيلية لإجاباتك مع الحلول النموذجية معروضة بالأسفل:`})]}),(0,l.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`20px`},children:b?.questions?.map((e,t)=>{let r=C.gradedQuestions?.[e.id],i=r?.correct??!1,ee=r?.chosenOption,a=r?.correctOption;return(0,l.jsxs)(`div`,{style:{border:i?`1px solid rgba(52, 211, 153, 0.2)`:`1px solid rgba(239, 68, 68, 0.2)`,background:i?`rgba(52, 211, 153, 0.02)`:`rgba(239, 68, 68, 0.02)`,padding:`20px`,borderRadius:`16px`,textAlign:`right`},children:[(0,l.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`,gap:`16px`},children:[(0,l.jsxs)(`span`,{style:{fontSize:`13px`,fontWeight:`bold`,color:_},children:[`السؤال `,t+1]}),(0,l.jsx)(`span`,{style:{fontSize:`11px`,fontWeight:`900`,padding:`2px 8px`,borderRadius:`8px`,background:i?`rgba(52, 211, 153, 0.15)`:`rgba(239, 68, 68, 0.15)`,color:i?`rgb(var(--fusha-teal-400))`:`rgb(var(--fusha-gold-700))`},children:i?`إجابة صحيحة`:`إجابة خاطئة`})]}),(0,l.jsx)(`p`,{style:{fontSize:`14.5px`,fontWeight:`800`,marginTop:`10px`,color:m,lineHeight:`1.6`},children:e.question_text}),e.image_url&&(0,l.jsx)(ne,{src:e.image_url,alt:``,style:{maxWidth:`100%`,maxHeight:`200px`,borderRadius:`8px`,marginTop:`10px`}}),(0,l.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`10px`,marginTop:`16px`},children:e.options?.map(e=>{let t=e===ee,r=e===a,i=`transparent`,o=n?`1px solid rgba(255,255,255,0.08)`:`1px solid rgba(0,0,0,0.08)`,s=m;return r?(i=`rgba(52, 211, 153, 0.15)`,o=`1px solid rgb(var(--fusha-teal-400))`,s=`rgb(var(--fusha-teal-400))`):t&&!r&&(i=`rgba(239, 68, 68, 0.15)`,o=`1px solid rgb(var(--fusha-gold-700))`,s=`rgb(var(--fusha-gold-700))`),(0,l.jsx)(`div`,{style:{padding:`10px 14px`,borderRadius:`10px`,border:o,backgroundColor:i,color:s,fontSize:`13px`,fontWeight:`700`},children:e},e)})})]},e.id)})}),(0,l.jsxs)(`div`,{style:{display:`flex`,gap:`12px`,marginTop:`32px`},children:[(0,l.jsx)(`button`,{className:`btn btn-primary flex-1`,onClick:k,children:`إغلاق المراجعة`}),(0,l.jsx)(`button`,{className:`btn btn-secondary`,onClick:()=>{b?.exam?.id&&O(b.exam.id)},style:{backgroundColor:n?`rgba(255,255,255,0.08)`:`rgba(0,0,0,0.06)`,color:m,border:`none`},children:`إعادة المحاولة`})]})]}):(0,l.jsxs)(`div`,{style:{textAlign:`right`},children:[(0,l.jsxs)(`div`,{style:{display:`flex`,gap:`16px`,flexWrap:`wrap`,marginBottom:`24px`,fontSize:`12px`,color:_},children:[(0,l.jsxs)(`span`,{className:`flex items-center gap-1`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`16px`},children:`checklist`}),`عدد الأسئلة: `,b?.questions?.length||0]}),(0,l.jsxs)(`span`,{className:`flex items-center gap-1`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`16px`},children:`grade`}),`الدرجة النهائية: `,b?.exam?.max_score||0,` درجة`]}),b?.exam?.time_limit_mins&&(0,l.jsxs)(`span`,{className:`flex items-center gap-1`,children:[(0,l.jsx)(`span`,{className:`material-symbols-outlined`,style:{fontSize:`16px`},children:`timer`}),`الزمن: `,b.exam.time_limit_mins,` دقيقة`]})]}),(0,l.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`24px`},children:b?.questions?.map((e,t)=>(0,l.jsxs)(`div`,{style:{border:n?`1px solid rgba(255,255,255,0.05)`:`1px solid rgba(0,0,0,0.05)`,background:n?`rgba(255,255,255,0.01)`:`rgba(0,0,0,0.01)`,padding:`20px`,borderRadius:`16px`},children:[(0,l.jsxs)(`span`,{style:{fontSize:`12px`,fontWeight:`bold`,color:`rgb(var(--primary))`},children:[`السؤال `,t+1]}),(0,l.jsx)(`p`,{style:{fontSize:`14.5px`,fontWeight:`800`,marginTop:`8px`,color:m,lineHeight:`1.6`},children:e.question_text}),e.image_url&&(0,l.jsx)(ne,{src:e.image_url,alt:``,style:{maxWidth:`100%`,maxHeight:`240px`,borderRadius:`8px`,marginTop:`10px`}}),(0,l.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`10px`,marginTop:`16px`},children:e.options?.map(t=>{let r=x[e.id]===t;return(0,l.jsx)(`button`,{onClick:()=>{S(n=>({...n,[e.id]:t}))},style:{padding:`12px 16px`,borderRadius:`10px`,border:r?`2px solid rgb(var(--primary))`:n?`1px solid rgba(255,255,255,0.08)`:`1px solid rgba(0,0,0,0.08)`,backgroundColor:r?`rgba(52, 211, 153, 0.08)`:`transparent`,color:r?`rgb(var(--primary))`:m,fontSize:`13px`,fontWeight:`700`,cursor:`pointer`,transition:`all 0.15s ease`,textAlign:`right`},children:t},t)})})]},e.id))}),(0,l.jsxs)(`div`,{style:{borderTop:n?`1px solid rgba(255,255,255,0.08)`:`1px solid rgba(0,0,0,0.08)`,marginTop:`32px`,paddingTop:`20px`,display:`flex`,gap:`12px`},children:[(0,l.jsx)(`button`,{className:`btn btn-primary flex-1`,onClick:Ee,disabled:T||Object.keys(x).length===0,children:T?`جاري تصحيح الإجابات...`:`تسليم الإجابات وعرض النتيجة`}),(0,l.jsx)(`button`,{className:`btn btn-secondary`,onClick:k,disabled:T,style:{backgroundColor:n?`rgba(255,255,255,0.08)`:`rgba(0,0,0,0.06)`,color:m,border:`none`},children:`إلغاء`})]})]})]})})]})};export{d as LoginRegister,d as default};
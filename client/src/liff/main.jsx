import React from 'react';
import ReactDOM from 'react-dom/client';
import liff from '@line/liff';
import App from './App.jsx';
import '../index.css';

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

// const LIFF_ID = import.meta.env.VITE_LIFF_ID;
// const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG;

// async function initLiff() {
//   await liff.init({ liffId: LIFF_ID });

//   if (!liff.isLoggedIn()) {
//     liff.login();
//     return;
//   }

//   const accessToken = liff.getAccessToken();

//   // Exchange LIFF token for our app JWT
//   const res = await fetch('/v1/auth/liff', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ liffAccessToken: accessToken, tenantSlug: TENANT_SLUG }),
//   });

//   if (!res.ok) {
//     document.getElementById('root').innerHTML =
//       '<div style="padding:2rem;text-align:center;color:#ef4444">เกิดข้อผิดพลาด กรุณาเปิดใหม่</div>';
//     return;
//   }

//   const { token } = await res.json();
//   sessionStorage.setItem('trainee_token', token);

//   ReactDOM.createRoot(document.getElementById('root')).render(
//     <React.StrictMode>
//       <App />
//     </React.StrictMode>
//   );
// }

// initLiff().catch((err) => {
//   console.error('[LIFF init]', err);
//   document.getElementById('root').innerHTML =
//     '<div style="padding:2rem;text-align:center;color:#ef4444">ไม่สามารถเชื่อมต่อ LINE ได้</div>';
// });


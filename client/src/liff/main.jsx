import React from 'react';
import ReactDOM from 'react-dom/client';
import liff from '@line/liff';
import App from './App.jsx';
import '../index.css';
import liffApi from '../api/liffApi.js';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG;

async function initLiff() {
  console.log('initiate LIFF')
  await liff.init({ 
    liffId: LIFF_ID,
    withLoginOnExternalBrowser: true 
  });

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  const accessToken = liff.getAccessToken();

  // Exchange LIFF token for our app JWT
  try {
    const res = await liffApi.post('/auth/liff', {
      liffAccessToken: accessToken,
      tenantSlug: TENANT_SLUG
    });

    const { token } = res.data;

    localStorage.setItem('trainee_token', token);
    console.log(token);

  } catch (error) {
    document.getElementById('root').innerHTML =
      '<div style="padding:2rem;text-align:center;color:#ef4444">เกิดข้อผิดพลาด กรุณาเปิดใหม่</div>';
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initLiff().catch((err) => {
  console.error('[LIFF init]', err);
  document.getElementById('root').innerHTML =
    '<div style="padding:2rem;text-align:center;color:#ef4444">ไม่สามารถเชื่อมต่อ LINE ได้</div>';
});


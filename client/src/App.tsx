import React, { useState, useEffect } from 'react';
import { VisitorPage } from './pages/VisitorPage.js';
import { ResidentPage } from './pages/ResidentPage.js';
import { HomePage } from './pages/HomePage.js';
import { DoorbellRouterPage } from './pages/DoorbellRouterPage.js';
import { ActivatePage } from './pages/ActivatePage.js';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Match /d/:serial (Hardware serialized plate QR entrypoint)
  if (currentPath.startsWith('/d/')) {
    const serial = currentPath.substring(3).split('/')[0].split('?')[0];
    return <DoorbellRouterPage serial={serial} />;
  }

  // Match /activar (Hardware activation portal)
  if (currentPath === '/activar' || currentPath.startsWith('/activar/')) {
    const optionalSerial = currentPath.replace('/activar', '').replace(/^\//, '').split('?')[0];
    return <ActivatePage initialSerial={optionalSerial || undefined} />;
  }

  // Match /v/:slug (Visitor view direct slug)
  if (currentPath.startsWith('/v/')) {
    const slug = currentPath.substring(3).split('/')[0].split('?')[0];
    return <VisitorPage slug={slug} />;
  }

  // Match /call/:callId (Resident intercom view)
  if (currentPath.startsWith('/call/')) {
    const callId = currentPath.substring(6).split('/')[0].split('?')[0];
    return <ResidentPage callId={callId} />;
  }

  // Default: Home Page
  return <HomePage />;
};

export default App;

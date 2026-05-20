import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './ats/auth/AuthContext.js';
import { RequireAuth } from './ats/auth/RequireAuth.js';
import { AUTH_ENABLED } from './ats/featureFlags.js';
import { LoginPage } from './ats/pages/LoginPage.js';
import { RegisterPage } from './ats/pages/RegisterPage.js';
import { JobsPage } from './pages/JobsPage.js';

export default function App({
  mode,
  onToggleTheme,
}: {
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const jobs = <JobsPage mode={mode} onToggleTheme={onToggleTheme} />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {AUTH_ENABLED ? (
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<RegisterPage />} />
              <Route path="/" element={<RequireAuth>{jobs}</RequireAuth>} />
            </>
          ) : (
            <>
              <Route path="/" element={jobs} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/cadastro" element={<Navigate to="/" replace />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

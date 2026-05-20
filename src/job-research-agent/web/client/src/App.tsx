import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './ats/auth/AuthContext.js';
import { RequireAuth } from './ats/auth/RequireAuth.js';
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
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <JobsPage mode={mode} onToggleTheme={onToggleTheme} />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

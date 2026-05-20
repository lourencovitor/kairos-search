import { Navigate, useLocation } from 'react-router-dom';

import { Box, CircularProgress } from '@mui/material';

import { AUTH_ENABLED } from '../featureFlags.js';
import { useAuth } from './AuthContext.js';

function RequireAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return children;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!AUTH_ENABLED) return <>{children}</>;
  return <RequireAuthGate>{children}</RequireAuthGate>;
}

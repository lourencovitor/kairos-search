import { useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

import { AtsApiError, atsApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { AuthPageShell } from '../components/AuthPageShell.js';

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  return raw;
}

export function LoginPage() {
  const theme = useTheme();
  const { isAuthenticated, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await atsApi.requestMagicCode(email.trim());
      setStep('code');
    } catch (err) {
      setError(err instanceof AtsApiError ? err.message : 'Não foi possível enviar o código');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await atsApi.verifyMagicCode(email.trim(), code.trim());
      await refresh();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof AtsApiError ? err.message : 'Código inválido ou expirado');
    } finally {
      setLoading(false);
    }
  }

  const subtitle =
    step === 'email'
      ? 'Entre com código mágico no e-mail. Sem senha, em segundos.'
      : `Enviamos um código de 6 dígitos para ${email}.`;

  return (
    <AuthPageShell
      subtitle={subtitle}
      footer={
        step === 'email' ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 3.5, textAlign: 'center', fontSize: '0.85rem' }}
          >
            Primeira vez aqui?{' '}
            <Link
              component={RouterLink}
              to="/cadastro"
              underline="none"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Criar conta grátis →
            </Link>
          </Typography>
        ) : undefined
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {step === 'email' ? (
        <Box component="form" onSubmit={(e) => void handleRequestCode(e)}>
          <Stack spacing={2.25}>
            <TextField
              label="E-mail profissional"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
              placeholder="voce@empresa.com"
              slotProps={{
                input: {
                  startAdornment: <EmailOutlinedIcon sx={{ mr: 1, opacity: 0.55, fontSize: 20 }} />,
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || !email.trim()}
              fullWidth
              endIcon={loading ? null : <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{
                py: 1.35,
                fontSize: '0.93rem',
                fontWeight: 700,
                letterSpacing: '-0.005em',
                background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                boxShadow: '0 8px 20px rgba(26,46,74,0.28)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #243F65, #356090)',
                  boxShadow: '0 10px 28px rgba(26,46,74,0.35)',
                },
                '&.Mui-disabled': {
                  background: alpha(theme.palette.primary.main, 0.3),
                  color: '#fff',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              ) : (
                'Enviar código por e-mail'
              )}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box component="form" onSubmit={(e) => void handleVerify(e)}>
          <Stack spacing={2.25}>
            <Box
              sx={{
                display: 'flex',
                gap: 1.25,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              }}
            >
              <MarkEmailReadOutlinedIcon sx={{ color: 'success.main', fontSize: 22, mt: 0.1 }} />
              <Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'success.main' }}>
                  Código enviado
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>
                  Confira a caixa de entrada de <strong>{email}</strong>. Pode levar alguns
                  segundos.
                </Typography>
              </Box>
            </Box>

            <TextField
              label="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              slotProps={{
                htmlInput: {
                  inputMode: 'numeric',
                  maxLength: 8,
                  style: { letterSpacing: '0.35em', fontFamily: 'monospace', fontWeight: 700 },
                },
                input: {
                  startAdornment: <PinOutlinedIcon sx={{ mr: 1, opacity: 0.55, fontSize: 20 }} />,
                },
              }}
              required
              fullWidth
              autoFocus
              placeholder="000000"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || code.trim().length < 4}
              fullWidth
              sx={{
                py: 1.35,
                fontSize: '0.93rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                boxShadow: '0 8px 20px rgba(26,46,74,0.28)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #243F65, #356090)',
                  boxShadow: '0 10px 28px rgba(26,46,74,0.35)',
                },
                '&.Mui-disabled': {
                  background: alpha(theme.palette.primary.main, 0.3),
                  color: '#fff',
                },
              }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Entrar na Kairos'}
            </Button>
            <Button
              type="button"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
              onClick={() => setStep('email')}
              sx={{
                color: 'text.secondary',
                alignSelf: 'flex-start',
                fontSize: '0.78rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Usar outro e-mail
            </Button>
          </Stack>
        </Box>
      )}
    </AuthPageShell>
  );
}

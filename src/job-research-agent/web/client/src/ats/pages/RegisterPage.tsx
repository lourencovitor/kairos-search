import { useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
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
import { REQUIRED_STRONG_TECH_COUNT } from '../constants.js';

const EMPTY_TECHS = Array.from({ length: REQUIRED_STRONG_TECH_COUNT }, () => '');

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  return raw;
}

export function RegisterPage() {
  const theme = useTheme();
  const { isAuthenticated, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [technologies, setTechnologies] = useState<string[]>(EMPTY_TECHS);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'profile' | 'code'>('profile');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function setTech(index: number, value: string) {
    setTechnologies((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function validateProfile(): string | null {
    if (!name.trim()) {
      return 'Informe seu nome.';
    }
    if (!email.trim()) {
      return 'Informe seu e-mail.';
    }
    const filled = technologies.map((t) => t.trim()).filter(Boolean);
    if (filled.length !== REQUIRED_STRONG_TECH_COUNT) {
      return `Informe exatamente ${REQUIRED_STRONG_TECH_COUNT} tecnologias onde você tem mais experiência.`;
    }
    return null;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateProfile();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await atsApi.register({
        name: name.trim(),
        email: email.trim(),
        technologies: technologies.map((t) => t.trim()),
      });
      setStep('code');
    } catch (err) {
      setError(err instanceof AtsApiError ? err.message : 'Não foi possível concluir o cadastro');
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

  const filledCount = technologies.filter((t) => t.trim()).length;
  const progress = Math.min(filledCount / REQUIRED_STRONG_TECH_COUNT, 1);

  const footer =
    step === 'profile' ? (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 3.5, textAlign: 'center', fontSize: '0.85rem' }}
      >
        Já tem conta?{' '}
        <Link
          component={RouterLink}
          to="/login"
          underline="none"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Entrar →
        </Link>
      </Typography>
    ) : undefined;

  const subtitle =
    step === 'profile'
      ? 'Conta grátis, sem senha. Vamos personalizar suas recomendações com base nas suas 5 stacks principais.'
      : `Falta um passo: ativar com o código enviado para ${email}.`;

  return (
    <AuthPageShell subtitle={subtitle} footer={footer} paperProps={{ sx: { maxWidth: 540 } }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {step === 'profile' ? (
        <Box component="form" onSubmit={(e) => void handleRegister(e)}>
          <Stack spacing={2.25}>
            <TextField
              label="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
              placeholder="Como devemos te chamar?"
              slotProps={{
                input: {
                  startAdornment: <BadgeOutlinedIcon sx={{ mr: 1, opacity: 0.55, fontSize: 20 }} />,
                },
              }}
            />
            <TextField
              label="E-mail profissional"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              placeholder="voce@empresa.com"
              slotProps={{
                input: {
                  startAdornment: <EmailOutlinedIcon sx={{ mr: 1, opacity: 0.55, fontSize: 20 }} />,
                },
              }}
            />

            <Divider sx={{ my: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  px: 1,
                }}
              >
                Suas {REQUIRED_STRONG_TECH_COUNT} stacks principais
              </Typography>
            </Divider>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              }}
            >
              <CodeOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{
                    height: 6,
                    borderRadius: 99,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${progress * 100}%`,
                      background: 'linear-gradient(90deg, #1A2E4A, #3D7EBF)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
              </Box>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color:
                    filledCount === REQUIRED_STRONG_TECH_COUNT ? 'success.main' : 'text.secondary',
                  fontFamily: 'monospace',
                  minWidth: 30,
                  textAlign: 'right',
                }}
              >
                {filledCount}/{REQUIRED_STRONG_TECH_COUNT}
              </Typography>
            </Box>

            <Stack spacing={1.25}>
              {technologies.map((tech, index) => (
                <TextField
                  key={index}
                  label={`Tecnologia ${index + 1}`}
                  value={tech}
                  onChange={(e) => setTech(index, e.target.value)}
                  required
                  fullWidth
                  size="small"
                  placeholder={
                    index === 0
                      ? 'Ex.: TypeScript'
                      : index === 1
                        ? 'Ex.: React'
                        : index === 2
                          ? 'Ex.: Node.js'
                          : index === 3
                            ? 'Ex.: PostgreSQL'
                            : 'Ex.: AWS'
                  }
                />
              ))}
            </Stack>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              fullWidth
              endIcon={loading ? null : <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{
                mt: 1,
                py: 1.4,
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
              {loading ? (
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              ) : (
                'Criar conta e enviar código'
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
                  Quase lá!
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>
                  Confirme o código enviado para <strong>{email}</strong> para ativar sua conta.
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
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Ativar conta'}
            </Button>
            <Button
              type="button"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
              onClick={() => setStep('profile')}
              sx={{
                color: 'text.secondary',
                alignSelf: 'flex-start',
                fontSize: '0.78rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Voltar ao formulário
            </Button>
          </Stack>
        </Box>
      )}
    </AuthPageShell>
  );
}

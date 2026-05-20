import { useCallback, useEffect, useRef, useState } from 'react';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type { JobOpportunity } from '../../api/types.js';
import { AtsApiError, atsApi } from '../api/client.js';
import type { AnalysisDto, ApplyVerdict, CandidateProfile } from '../api/types.js';
import { loadCvProfile, saveCvProfile } from '../profileStorage.js';
import { ApplyVerdictBanner, ApplyVerdictPill } from './ApplyVerdictBanner.js';
import { ScoreBreakdownView } from './ScoreBreakdownView.js';
import { ScoreGauge } from './ScoreGauge.js';

type Phase = 'loading' | 'auth' | 'cv' | 'analyzing' | 'result' | 'error';

export function AtsAnalysisModal(props: {
  readonly open: boolean;
  readonly job: JobOpportunity | null;
  readonly isDark: boolean;
  readonly onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [atsJobId, setAtsJobId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const bootstrap = useCallback(async (job: JobOpportunity) => {
    setPhase('loading');
    setError(null);
    setAnalysis(null);
    const sourceId = job.sourceId ?? job.url;
    try {
      const { data: atsJob } = await atsApi.lookupJob(job.source, sourceId);
      setAtsJobId(atsJob.id);
      const loggedIn = await atsApi.checkSession();
      const stored = loadCvProfile();
      setProfile(stored);
      setPhase(loggedIn ? (stored ? 'cv' : 'cv') : 'auth');
    } catch (err) {
      const msg =
        err instanceof AtsApiError && err.status === 404
          ? 'Esta vaga ainda não está no índice ATS. Rode a ingestão no Kairos ATS (worker-search) e tente de novo.'
          : err instanceof Error
            ? err.message
            : 'Não foi possível preparar a análise';
      setError(msg);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (props.open && props.job) {
      void bootstrap(props.job);
    }
    return () => {
      stopPoll();
    };
  }, [props.open, props.job, bootstrap, stopPoll]);

  useEffect(() => {
    if (!props.open) {
      stopPoll();
      setPhase('loading');
      setError(null);
      setCode('');
    }
  }, [props.open, stopPoll]);

  async function handleRequestCode() {
    setError(null);
    try {
      await atsApi.requestMagicCode(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar código');
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      await atsApi.verifyMagicCode(email.trim(), code.trim());
      setPhase('cv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { data } = await atsApi.uploadCv(file);
      setProfile(data.profile);
      saveCvProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar CV');
    } finally {
      setUploading(false);
    }
  }

  async function pollAnalysis(id: string) {
    const { data } = await atsApi.getAnalysis(id);
    setAnalysis(data);
    if (data.status === 'done' || data.status === 'failed') {
      stopPoll();
      setPhase(data.status === 'done' ? 'result' : 'error');
      if (data.status === 'failed') {
        setError(data.error ?? 'Análise falhou');
      }
    }
  }

  async function handleAnalyze() {
    if (!atsJobId || !profile) {
      return;
    }
    setError(null);
    setPhase('analyzing');
    try {
      const { data } = await atsApi.createAnalysis(atsJobId, profile);
      setAnalysis(data);
      stopPoll();
      if (data.status === 'done') {
        setPhase('result');
        return;
      }
      pollRef.current = setInterval(() => {
        void pollAnalysis(data.id).catch((err) => {
          setError(err instanceof Error ? err.message : 'Erro ao consultar análise');
          stopPoll();
          setPhase('error');
        });
      }, 2000);
      await pollAnalysis(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar análise');
      setPhase('error');
    }
  }

  const verdict: ApplyVerdict | null =
    analysis?.scoreBreakdown.applyVerdict ?? (analysis?.status === 'done' ? null : null);

  const verdictReason = analysis?.scoreBreakdown.applyVerdictReason ?? '';

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            bgcolor: props.isDark ? '#121820' : 'background.paper',
            border: `1px solid ${props.isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}`,
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <AnalyticsOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              Análise ATS
            </Typography>
            {props.job && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {props.job.title} · {props.job.companyName}
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton onClick={props.onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {phase === 'loading' && (
          <Stack spacing={2} sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress size={32} />
            <Typography color="text.secondary">Preparando análise…</Typography>
          </Stack>
        )}

        {phase === 'auth' && (
          <Stack spacing={2} sx={{ maxWidth: 400, mx: 'auto', py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Entre com o e-mail para guardar suas análises. Em dev, o código aparece no log da API
              Kairos (<code>magic code</code>).
            </Typography>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="outlined"
              onClick={() => void handleRequestCode()}
              disabled={!email.trim()}
            >
              Enviar código
            </Button>
            <TextField
              label="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              onClick={() => void handleVerify()}
              disabled={!email.trim() || !code.trim()}
            >
              Entrar
            </Button>
          </Stack>
        )}

        {(phase === 'cv' || phase === 'analyzing') && (
          <Stack spacing={2}>
            <Typography variant="subtitle2">1. Seu CV (memória, LGPD)</Typography>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button
              variant="outlined"
              startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadOutlinedIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {profile ? 'Trocar CV' : 'Enviar PDF ou DOCX'}
            </Button>
            {profile && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                <Chip size="small" label={`${profile.yearsTotalExperience} anos`} />
                <Chip size="small" label={profile.seniorityHint} />
                {profile.skills.slice(0, 6).map((s) => (
                  <Chip key={s.name} size="small" variant="outlined" label={s.name} />
                ))}
              </Stack>
            )}
            <Divider />
            <Typography variant="subtitle2">2. Rodar análise determinística</Typography>
            <Button
              variant="contained"
              size="large"
              disabled={!profile || phase === 'analyzing'}
              onClick={() => void handleAnalyze()}
            >
              {phase === 'analyzing' ? 'Analisando…' : 'Analisar fit com esta vaga'}
            </Button>
            {phase === 'analyzing' && <LinearProgress />}
          </Stack>
        )}

        {phase === 'result' && analysis && (
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              sx={{ alignItems: { xs: 'center', sm: 'flex-start' } }}
            >
              <Stack spacing={1} sx={{ alignItems: 'center' }}>
                <ScoreGauge score={analysis.score} />
                {verdict && <ApplyVerdictPill verdict={verdict} />}
              </Stack>
              <Box sx={{ flex: 1, width: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                  Breakdown (regras {analysis.rulesVersion})
                </Typography>
                <ScoreBreakdownView matchers={analysis.scoreBreakdown.matchers} />
              </Box>
            </Stack>

            {analysis.summary && (
              <>
                <Divider />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Por que esse score
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {analysis.summary}
                </Typography>
              </>
            )}

            {analysis.gaps && analysis.gaps.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                  Gaps
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {analysis.gaps.map((g) => (
                    <Typography component="li" variant="body2" key={g}>
                      {g}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {analysis.improvementSuggestions && analysis.improvementSuggestions.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                  Passo a passo
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {analysis.improvementSuggestions.map((s) => (
                    <Typography component="li" variant="body2" key={s}>
                      {s}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {verdict && verdictReason && (
              <ApplyVerdictBanner verdict={verdict} reason={verdictReason} />
            )}
          </Stack>
        )}

        {phase === 'error' && !error && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Algo deu errado. Feche e tente novamente.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}

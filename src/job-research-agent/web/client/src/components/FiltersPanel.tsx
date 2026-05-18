import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputAdornment, Slider, Stack, TextField, Typography } from '@mui/material';

import { marketLabel } from '../utils/format-helpers.js';
import { FilterSelect } from './FilterSelect.js';

interface FiltersPanelProps {
  query: string;
  onQueryChange: (v: string) => void;
  market: string;
  markets: string[];
  onMarketChange: (v: string) => void;
  score: number;
  onScoreChange: (v: number) => void;
  remoteOnly: boolean;
  onRemoteOnlyToggle: () => void;
}

export function FiltersPanel({
  query,
  onQueryChange,
  market,
  markets,
  onMarketChange,
  score,
  onScoreChange,
  remoteOnly,
  onRemoteOnlyToggle,
}: FiltersPanelProps) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Buscar"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="React, AWS, Stripe..."
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <FilterSelect
        label="Mercado"
        value={market}
        options={markets.map((m) => [m, marketLabel(m)])}
        onChange={onMarketChange}
      />
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}
          >
            Relevância mínima
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, color: 'primary.main', fontSize: '0.72rem' }}
          >
            {score > 0 ? `${score}+` : 'Todas'}
          </Typography>
        </Stack>
        <Slider
          value={score}
          onChange={(_, v) => onScoreChange(v as number)}
          min={0}
          max={100}
          size="small"
        />
      </Box>
      <Button
        size="small"
        variant={remoteOnly ? 'contained' : 'outlined'}
        onClick={onRemoteOnlyToggle}
        sx={{
          justifyContent: 'flex-start',
          fontSize: '0.8rem',
          ...(remoteOnly
            ? { background: 'linear-gradient(135deg, #1A2E4A, #2B5072)' }
            : { borderColor: 'divider', color: 'text.secondary' }),
        }}
      >
        {remoteOnly ? '✓ Apenas remoto' : 'Apenas remoto'}
      </Button>
    </Stack>
  );
}

import { useEffect, useState } from 'react';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Box, CircularProgress, Fade, Tooltip } from '@mui/material';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = window.scrollY;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
      setVisible(scrolled > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Fade in={visible}>
      <Tooltip title="Voltar ao topo" placement="left" arrow>
        <Box
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            bottom: { xs: 20, md: 32 },
            right: { xs: 20, md: 32 },
            zIndex: 1200,
            width: 52,
            height: 52,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Progress ring */}
          <CircularProgress
            variant="determinate"
            value={progress}
            size={52}
            thickness={2.5}
            sx={{
              position: 'absolute',
              color: '#3D7EBF',
              filter: 'drop-shadow(0 0 6px rgba(61,126,191,0.5))',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
                transition: 'stroke-dashoffset 0.1s ease',
              },
            }}
          />

          {/* Track ring */}
          <CircularProgress
            variant="determinate"
            value={100}
            size={52}
            thickness={2.5}
            sx={{
              position: 'absolute',
              color: 'rgba(61,126,191,0.12)',
            }}
          />

          {/* Button core */}
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A2E4A 0%, #2B5072 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(26,46,74,0.45)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
              '.MuiBox-root:hover > &': {
                background: 'linear-gradient(135deg, #243F65 0%, #356090 100%)',
                boxShadow: '0 6px 28px rgba(26,46,74,0.6)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <KeyboardArrowUpIcon
              sx={{
                color: '#fff',
                fontSize: 20,
                transition: 'transform 0.2s ease',
                '.MuiBox-root:hover &': { transform: 'translateY(-1px)' },
              }}
            />
          </Box>
        </Box>
      </Tooltip>
    </Fade>
  );
}

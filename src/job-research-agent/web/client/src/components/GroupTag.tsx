import type { ReactNode } from 'react';

import { Box, Typography } from '@mui/material';

interface GroupTagProps {
  children: ReactNode;
  bg: string;
  color: string;
}

export function GroupTag({ children, bg, color }: GroupTagProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: '7px',
        py: '2px',
        borderRadius: '4px',
        bgcolor: bg,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.63rem',
          fontWeight: 700,
          color,
          lineHeight: '16px',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

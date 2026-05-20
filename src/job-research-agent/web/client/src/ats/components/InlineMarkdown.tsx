import { Fragment, type ReactNode } from 'react';

import { Box, type SxProps, type Theme } from '@mui/material';

/**
 * Inline-only markdown renderer for short analysis snippets.
 * Supports **bold**, *italic*, `code`. Ignores anything else.
 */

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string };

const PATTERN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      tokens.push({ type: 'text', value: input.slice(lastIndex, start) });
    }
    const raw = match[0];
    if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('*')) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    }
    lastIndex = start + raw.length;
  }
  if (lastIndex < input.length) {
    tokens.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return tokens;
}

function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((t, i) => {
    if (t.type === 'bold') {
      return (
        <Box key={i} component="strong" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {t.value}
        </Box>
      );
    }
    if (t.type === 'italic') {
      return (
        <Box key={i} component="em" sx={{ fontStyle: 'italic' }}>
          {t.value}
        </Box>
      );
    }
    if (t.type === 'code') {
      return (
        <Box
          key={i}
          component="code"
          sx={{
            px: 0.6,
            py: 0.15,
            mx: 0.25,
            borderRadius: '4px',
            bgcolor: (th) =>
              th.palette.mode === 'dark' ? 'rgba(148,163,184,0.18)' : 'rgba(15,31,46,0.06)',
            fontFamily: '"SF Mono","Cascadia Code",monospace',
            fontSize: '0.85em',
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          {t.value}
        </Box>
      );
    }
    return <Fragment key={i}>{t.value}</Fragment>;
  });
}

interface InlineMarkdownProps {
  readonly children: string;
  readonly sx?: SxProps<Theme>;
  readonly component?: React.ElementType;
}

export function InlineMarkdown({ children, sx, component = 'span' }: InlineMarkdownProps) {
  const lines = children.split(/\n+/);
  return (
    <Box component={component} sx={sx}>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {idx > 0 && <br />}
          {renderTokens(tokenize(line))}
        </Fragment>
      ))}
    </Box>
  );
}

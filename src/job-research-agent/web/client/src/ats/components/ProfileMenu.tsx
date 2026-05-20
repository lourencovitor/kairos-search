import { useState } from 'react';

import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import {
  Avatar,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

import type { UserDto } from '../api/types.js';

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  return email.slice(0, 2).toUpperCase();
}

interface ProfileMenuProps {
  readonly user: UserDto | null;
  readonly isDark: boolean;
  readonly onLogout: () => void;
}

export function ProfileMenu({ user, isDark, onLogout }: ProfileMenuProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  if (!user) return null;

  const displayName = user.name?.trim() || user.email.split('@')[0];
  const initials = getInitials(user.name, user.email);

  return (
    <>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disableRipple
        sx={{
          minWidth: 0,
          textTransform: 'none',
          color: 'text.primary',
          borderRadius: '999px',
          padding: { xs: '3px', sm: '3px 10px 3px 3px' },
          gap: 1,
          border: '1px solid',
          borderColor: open
            ? theme.palette.primary.main
            : isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(15,31,46,0.1)',
          background: open
            ? isDark
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.25)}, ${alpha(theme.palette.primary.main, 0.05)})`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, #FFFFFF)`
            : isDark
              ? 'rgba(30,41,59,0.5)'
              : '#FFFFFF',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            transform: 'translateY(-1px)',
            boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.4)' : '0 6px 20px rgba(15,31,46,0.1)',
          },
        }}
      >
        <Box sx={{ position: 'relative', display: 'flex' }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.74rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #3D7EBF 0%, #1A2E4A 100%)',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              boxShadow: '0 4px 10px rgba(26,46,74,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
              border: isDark
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.3)',
            }}
          >
            {initials}
          </Avatar>
          <Box
            sx={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: '#22C55E',
              border: '2px solid',
              borderColor: isDark ? '#1E293B' : '#FFFFFF',
              boxShadow: '0 0 0 1px rgba(34,197,94,0.4)',
            }}
          />
        </Box>
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            flexDirection: 'column',
            alignItems: 'flex-start',
            lineHeight: 1,
            minWidth: 0,
            maxWidth: 140,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '-0.015em',
              lineHeight: 1.1,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {displayName}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.62rem',
              fontWeight: 600,
              color: 'text.secondary',
              lineHeight: 1.3,
              mt: 0.25,
              letterSpacing: '0.04em',
            }}
          >
            Meu perfil
          </Typography>
        </Box>
        <KeyboardArrowDownRoundedIcon
          sx={{
            fontSize: 18,
            color: 'text.secondary',
            display: { xs: 'none', sm: 'block' },
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 296,
              borderRadius: 2.5,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)',
              boxShadow: isDark
                ? '0 24px 60px rgba(0,0,0,0.55)'
                : '0 24px 60px rgba(15,31,46,0.18)',
            },
          },
          list: { sx: { p: 0 } },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            px: 2.5,
            pt: 2.5,
            pb: 2.25,
            background: 'linear-gradient(135deg, #0D1B2E 0%, #1A3055 60%, #132540 100%)',
            color: '#FFFFFF',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-30%',
              right: '-25%',
              width: '70%',
              height: '120%',
              background: 'radial-gradient(circle, rgba(61,126,191,0.4) 0%, transparent 65%)',
              filter: 'blur(30px)',
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1.75}
            sx={{ alignItems: 'center', position: 'relative', zIndex: 1 }}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #3D7EBF 0%, #1A2E4A 100%)',
                  color: '#FFFFFF',
                  letterSpacing: '-0.025em',
                  border: '2px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {initials}
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: '#22C55E',
                  border: '3px solid #0D1B2E',
                }}
              />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center' }}>
                <Typography
                  sx={{
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#FFFFFF',
                  }}
                >
                  {displayName}
                </Typography>
                {user.profileComplete && <VerifiedIcon sx={{ fontSize: 16, color: '#7FB5E8' }} />}
              </Stack>
              <Typography
                sx={{
                  fontSize: '0.74rem',
                  color: 'rgba(255,255,255,0.65)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mt: 0.1,
                }}
              >
                {user.email}
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.85,
                  px: 0.9,
                  py: 0.25,
                  borderRadius: 99,
                  bgcolor: 'rgba(34,197,94,0.18)',
                  border: '1px solid rgba(34,197,94,0.32)',
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#22C55E',
                    boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#86EFAC',
                    letterSpacing: '0.04em',
                  }}
                >
                  Conta ativa
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Box>

        {user.strongTechnologies.length > 0 && (
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
              <WorkspacePremiumOutlinedIcon sx={{ fontSize: 13, color: 'primary.main' }} />
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                Stack principal
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.6 }} useFlexGap>
              {user.strongTechnologies.slice(0, 6).map((tech) => (
                <Box
                  key={tech}
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: '6px',
                    bgcolor: isDark
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    border: '1px solid',
                    borderColor: isDark
                      ? alpha(theme.palette.primary.main, 0.35)
                      : alpha(theme.palette.primary.main, 0.18),
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    fontFamily: '"SF Mono","Cascadia Code",monospace',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {tech}
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ py: 0.5 }}>
          <MenuItem disabled sx={{ opacity: '0.85 !important', py: 1 }}>
            <ListItemIcon>
              <PersonOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Editar conta"
              secondary="Em breve"
              slotProps={{
                primary: { sx: { fontSize: '0.84rem', fontWeight: 600 } },
                secondary: { sx: { fontSize: '0.68rem' } },
              }}
            />
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              onLogout();
            }}
            sx={{
              py: 1.2,
              color: 'error.main',
              '&:hover': {
                bgcolor: isDark
                  ? alpha(theme.palette.error.main, 0.14)
                  : alpha(theme.palette.error.main, 0.08),
              },
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Sair da conta"
              slotProps={{ primary: { sx: { fontSize: '0.84rem', fontWeight: 700 } } }}
            />
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}

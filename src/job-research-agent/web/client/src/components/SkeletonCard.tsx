import { Box, Card, CardContent, Skeleton, Stack } from '@mui/material';

export function SkeletonCard() {
  return (
    <Card>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Skeleton
            variant="rounded"
            width={44}
            height={44}
            sx={{ borderRadius: '12px', flexShrink: 0 }}
          />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="58%" height={24} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="38%" height={18} sx={{ mb: 1.25 }} />
            <Stack direction="row" spacing={0.5}>
              {[55, 70, 48, 62, 45].map((w) => (
                <Skeleton
                  key={w}
                  variant="rounded"
                  width={w}
                  height={17}
                  sx={{ borderRadius: '4px' }}
                />
              ))}
            </Stack>
          </Box>
          <Stack sx={{ alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            <Skeleton variant="circular" width={58} height={58} />
            <Skeleton variant="rounded" width={74} height={20} sx={{ borderRadius: '5px' }} />
            <Skeleton variant="text" width={60} height={16} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}

export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      >
        <MenuItem value="">Todos</MenuItem>
        {options.map(([v, l]) => (
          <MenuItem key={v} value={v}>
            {l}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

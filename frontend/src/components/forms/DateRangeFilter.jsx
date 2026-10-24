import { useId } from 'react';
import FormField from '../common/FormField';

export default function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  startError,
  endError,
  disabled = false,
}) {
  const id = useId();
  return (
    <>
      <FormField label="Start Date" htmlFor={`${id}-start`} required error={startError}>
        <input
          id={`${id}-start`}
          type="date"
          className="input"
          value={startDate}
          max={endDate || undefined}
          onChange={(event) => onStartChange(event.target.value)}
          disabled={disabled}
          aria-invalid={startError ? 'true' : undefined}
        />
      </FormField>
      <FormField label="End Date" htmlFor={`${id}-end`} required error={endError}>
        <input
          id={`${id}-end`}
          type="date"
          className="input"
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => onEndChange(event.target.value)}
          disabled={disabled}
          aria-invalid={endError ? 'true' : undefined}
        />
      </FormField>
    </>
  );
}

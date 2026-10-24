import { useId } from 'react';
import { getDistricts, getRegionsForDistrict, STATES } from '../../data/studyAreas';
import FormField from '../common/FormField';

export default function RegionSelector({
  stateValue,
  districtValue,
  regionValue,
  onStateChange,
  onDistrictChange,
  onRegionChange,
  stateError,
  districtError,
  regionError,
  showDistrict = true,
  showRegion = true,
  disabled = false,
}) {
  const id = useId();
  const districts = stateValue ? getDistricts(stateValue) : [];
  const regions = stateValue && districtValue ? getRegionsForDistrict(stateValue, districtValue) : [];

  return (
    <>
      <FormField label="State" htmlFor={`${id}-state`} required error={stateError}>
        <select
          id={`${id}-state`}
          className="select"
          value={stateValue}
          onChange={(event) => onStateChange(event.target.value)}
          disabled={disabled}
          aria-invalid={stateError ? 'true' : undefined}
        >
          <option value="">Select a state</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </FormField>

      {showDistrict && (
        <FormField label="District" htmlFor={`${id}-district`} required error={districtError}>
          <select
            id={`${id}-district`}
            className="select"
            value={districtValue}
            onChange={(event) => onDistrictChange(event.target.value)}
            disabled={disabled || !stateValue}
            aria-invalid={districtError ? 'true' : undefined}
          >
            <option value="">{stateValue ? 'Select a district' : 'Select a state first'}</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {showRegion && (
        <FormField label="Region / Forest Area" htmlFor={`${id}-region`} required error={regionError}>
          <select
            id={`${id}-region`}
            className="select"
            value={regionValue}
            onChange={(event) => onRegionChange(event.target.value)}
            disabled={disabled || !districtValue}
            aria-invalid={regionError ? 'true' : undefined}
          >
            <option value="">{districtValue ? 'Select a forest area' : 'Select a district first'}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </FormField>
      )}
    </>
  );
}

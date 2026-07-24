"use client";

import { RequiredMark } from "@/app/components/required-mark";
import { BR_STATES } from "@/lib/br-states";
import { inputClass, labelClass } from "@/lib/ui";
import { useIbgeCities } from "@/lib/use-ibge-cities";

type LocationFieldsProps = {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  // Cadastro forms require both fields; profile-edit forms don't (the PATCH
  // endpoints' validation is untouched, still optional), so this controls
  // both the `required` attribute and the visible RequiredMark.
  required: boolean;
};

// Shared "Estado" + "Cidade" pair used by every form that collects an
// address (cadastro and profile-edit, family and caregiver). City is
// IBGE-backed and always resets when the state changes, since a city name
// from the previous state is meaningless once the state changes.
export function LocationFields({
  state,
  city,
  onStateChange,
  onCityChange,
  required,
}: LocationFieldsProps) {
  const { cities, loading, error } = useIbgeCities(state);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor="state" className={labelClass}>
          Estado
          {required && <RequiredMark />}
        </label>
        <select
          id="state"
          required={required}
          value={state}
          onChange={(event) => onStateChange(event.target.value)}
          className={inputClass}
        >
          <option value="">Selecione</option>
          {BR_STATES.map((brState) => (
            <option key={brState.uf} value={brState.uf}>
              {brState.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="city" className={labelClass}>
          Cidade
          {required && <RequiredMark />}
        </label>

        {error ? (
          <>
            <input
              id="city"
              type="text"
              required={required}
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </>
        ) : (
          <select
            id="city"
            required={required}
            disabled={!state || loading}
            value={city}
            onChange={(event) => onCityChange(event.target.value)}
            className={inputClass}
          >
            <option value="">
              {!state
                ? "Selecione o estado primeiro"
                : loading
                  ? "Carregando..."
                  : "Selecione"}
            </option>
            {cities.map((cityName) => (
              <option key={cityName} value={cityName}>
                {cityName}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

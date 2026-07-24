"use client";

import { Combobox } from "@/app/components/combobox";
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

const STATE_OPTIONS = BR_STATES.map((state) => ({ value: state.uf, label: state.name }));

// Shared "Estado" + "Cidade" pair used by every form that collects an
// address (cadastro and profile-edit, family and caregiver). Both are
// searchable comboboxes (see app/components/combobox.tsx) rather than
// native <select>s, so a long city list can be filtered by typing while
// still only accepting a value that's actually in the list. City is
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
  const cityOptions = cities.map((cityName) => ({ value: cityName, label: cityName }));

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor="state" className={labelClass}>
          Estado
          {required && <RequiredMark />}
        </label>
        <Combobox
          id="state"
          value={state}
          options={STATE_OPTIONS}
          onChange={onStateChange}
          required={required}
          placeholder="Selecione"
        />
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
          <Combobox
            id="city"
            value={city}
            options={cityOptions}
            onChange={onCityChange}
            required={required}
            disabled={!state || loading}
            placeholder={
              !state ? "Selecione o estado primeiro" : loading ? "Carregando..." : "Selecione"
            }
            emptyMessage={loading ? "Carregando..." : "Nenhuma cidade encontrada"}
          />
        )}
      </div>
    </div>
  );
}

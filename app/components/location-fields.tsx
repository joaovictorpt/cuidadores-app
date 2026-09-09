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
  // Formulários de cadastro exigem os dois campos; formulários de edição de
  // perfil não (a validação dos endpoints PATCH continua intocada, ainda
  // opcional), então isso controla tanto o atributo `required` quanto o
  // RequiredMark visível.
  required: boolean;
};

const STATE_OPTIONS = BR_STATES.map((state) => ({ value: state.uf, label: state.name }));

// Par compartilhado "Estado" + "Cidade" usado por todo formulário que coleta
// um endereço (cadastro e edição de perfil, família e cuidador). Os dois são
// comboboxes pesquisáveis (ver app/components/combobox.tsx) em vez de
// <select>s nativos, para que uma lista longa de cidades possa ser filtrada
// digitando, mas ainda assim só aceitando um valor que realmente esteja na
// lista. Cidade é alimentada pelo IBGE e sempre reseta quando o estado muda,
// já que um nome de cidade do estado anterior perde o sentido assim que o
// estado muda.
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

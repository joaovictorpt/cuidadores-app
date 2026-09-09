"use client";

import { PatternFormat } from "react-number-format";

import { inputClass } from "@/lib/ui";

type BirthDateInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

// Campo de data de nascimento mascarado DD/MM/AAAA, construído sobre o
// PatternFormat do react-number-format -- o mesmo componente já usado por
// PhoneInput, então a digitação se comporta de forma idêntica (um cursor de
// texto normal, não o seletor de segmentos dia/mês/ano do
// <input type="date"> nativo). `onChange` recebe os dígitos sem formatação
// (`values.value`); ver lib/age.ts#parseBirthDateInput para transformar isso
// numa `Date` de fato assim que o usuário termina de digitar.
export function BirthDateInput({ id, value, onChange, required }: BirthDateInputProps) {
  return (
    <PatternFormat
      id={id}
      type="text"
      format="##/##/####"
      placeholder="dd/mm/aaaa"
      required={required}
      value={value}
      onValueChange={(values) => onChange(values.value)}
      className={inputClass}
    />
  );
}

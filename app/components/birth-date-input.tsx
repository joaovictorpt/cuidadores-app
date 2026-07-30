"use client";

import { PatternFormat } from "react-number-format";

import { inputClass } from "@/lib/ui";

type BirthDateInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

// Masked DD/MM/AAAA birth date field, built on react-number-format's
// PatternFormat -- the same component already used for PhoneInput, so
// typing behaves identically (a normal text cursor, not the native
// <input type="date">'s day/month/year segment picker). `onChange` receives
// the unformatted digits (`values.value`); see lib/age.ts#parseBirthDateInput
// for turning that into an actual Date once the user finishes typing.
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

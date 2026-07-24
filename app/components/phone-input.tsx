"use client";

import { PatternFormat } from "react-number-format";

import { inputClass } from "@/lib/ui";

type PhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

// Masked (XX) XXXXX-XXXX Brazilian phone field, built on react-number-format
// (see CLAUDE.md "Sistema de design") instead of a hand-rolled mask -- it
// already handles caret position, backspacing through mask characters, and
// blocking non-digit input correctly. `onChange` receives the unformatted
// digits (`values.value`), which is what gets persisted/sent to the API.
export function PhoneInput({ id, value, onChange }: PhoneInputProps) {
  return (
    <PatternFormat
      id={id}
      type="tel"
      format="(##) #####-####"
      value={value}
      onValueChange={(values) => onChange(values.value)}
      className={inputClass}
    />
  );
}

"use client";

import { PatternFormat } from "react-number-format";

import { inputClass } from "@/lib/ui";

type PhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

// Campo de telefone brasileiro mascarado (XX) XXXXX-XXXX, construído sobre o
// react-number-format (ver CLAUDE.md "Sistema de design") em vez de uma
// máscara escrita à mão -- ele já lida corretamente com a posição do cursor,
// backspace sobre caracteres da máscara, e bloqueio de entrada que não seja
// dígito. `onChange` recebe os dígitos sem formatação (`values.value`), que é
// o que é persistido/enviado para a API.
export function PhoneInput({ id, value, onChange }: PhoneInputProps) {
  return (
    <PatternFormat
      id={id}
      type="tel"
      format="(##) #####-####"
      placeholder="(00) 00000-0000"
      value={value}
      onValueChange={(values) => onChange(values.value)}
      className={inputClass}
    />
  );
}

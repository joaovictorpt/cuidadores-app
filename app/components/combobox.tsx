"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { inputClass } from "@/lib/ui";

export type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  id: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyMessage?: string;
};

// Diacritic-insensitive compare so "goias"/"sao paulo" (no accents -- common
// when typing quickly) still matches "Goiás"/"São Paulo".
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Accessible single-select searchable combobox (ARIA 1.2 "combobox with
// list autocomplete" pattern), backing the Estado/Cidade fields in
// app/components/location-fields.tsx. Unlike a native <select>, it lets the
// user filter a long option list by typing -- but unlike a plain <input>,
// the value that actually reaches `onChange` can only ever be one of
// `options`: free text that doesn't match anything is discarded on blur
// (reverted to the last valid selection), never propagated as a value.
export function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  emptyMessage = "Nenhum resultado",
}: ComboboxProps) {
  const listboxId = `${id}-listbox`;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the displayed text in sync when the selection changes from the
  // outside (e.g. LocationFields resetting city to "" when state changes).
  useEffect(() => {
    setQuery(selectedOption?.label ?? "");
    setHasUserTyped(false);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!hasUserTyped || !query.trim()) return options;
    const needle = normalizeForSearch(query);
    return options.filter((option) => normalizeForSearch(option.label).includes(needle));
  }, [options, query, hasUserTyped]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  function commit(option: ComboboxOption | null) {
    onChange(option?.value ?? "");
    setQuery(option?.label ?? "");
    setHasUserTyped(false);
    setIsOpen(false);
  }

  function handleBlur() {
    // An exact (diacritic/case-insensitive) match on blur still counts as a
    // selection, so tabbing away right after typing a full valid name
    // works -- anything else reverts to the last valid selection instead
    // of leaking free text into the form's state.
    const typed = normalizeForSearch(query);
    const exactMatch = options.find((option) => normalizeForSearch(option.label) === typed);
    commit(exactMatch ?? selectedOption);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((index) =>
        filteredOptions.length === 0 ? 0 : (index + 1) % filteredOptions.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((index) =>
        filteredOptions.length === 0
          ? 0
          : (index - 1 + filteredOptions.length) % filteredOptions.length
      );
      return;
    }

    if (event.key === "Enter") {
      // Also stops this from submitting the surrounding <form>.
      if (isOpen) {
        event.preventDefault();
        const chosen = filteredOptions[highlightedIndex];
        if (chosen) commit(chosen);
      }
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setQuery(selectedOption?.label ?? "");
      setHasUserTyped(false);
      setIsOpen(false);
    }
  }

  const activeOptionId =
    isOpen && filteredOptions[highlightedIndex]
      ? `${id}-option-${filteredOptions[highlightedIndex].value}`
      : undefined;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setHasUserTyped(true);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={inputClass}
      />

      {isOpen && !disabled && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-muted/40 bg-white py-1 shadow-sm"
        >
          {filteredOptions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{emptyMessage}</li>
          )}
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${option.value}`}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(event) => {
                // Prevents the input from blurring before the click is
                // processed -- without this, the dropdown would unmount
                // (isOpen -> false via blur) before onClick ever fires.
                event.preventDefault();
                commit(option);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightedIndex ? "bg-primary text-white" : "text-ink hover:bg-primary-light"
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

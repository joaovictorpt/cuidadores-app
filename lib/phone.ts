// Fonte única de verdade para "isto é um celular brasileiro completo",
// compartilhada pelos schemas Zod em app/api/register, app/api/family-profile
// e app/api/caregiver-profile (checagem autoritativa) e pelos 4 formulários
// que coletam telefone via PhoneInput (checagem client-side antes do submit,
// mesmo padrão de lib/age.ts para data de nascimento). O onChange do
// PhoneInput já devolve só dígitos (values.value do react-number-format),
// então isso só precisa checar o tamanho -- 2 dígitos de DDD + 9 dígitos do
// número, o formato que um celular brasileiro tem.
export const PHONE_DIGIT_LENGTH = 11;

export const PHONE_REGEX = new RegExp(`^\\d{${PHONE_DIGIT_LENGTH}}$`);

export const PHONE_INVALID_MESSAGE =
  "Telefone inválido — informe DDD + 9 dígitos";

export function isCompletePhone(digits: string): boolean {
  return PHONE_REGEX.test(digits);
}

// Remove tudo que não for dígito -- proteção defensiva para os dois helpers
// abaixo: o app só armazena telefones só com dígitos (ver PhoneInput), mas
// estes constroem strings/URIs voltadas ao usuário, então um caractere de
// formatação perdido que passe não deveria produzir um valor de exibição ou
// link wa.me quebrado.
function sanitizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Formatação de exibição somente-leitura ("(XX) XXXXX-XXXX") -- espelha a
// máscara que app/components/phone-input.tsx aplica durante a digitação, mas
// para contextos (informação de contato do Hire) que só mostram um número já
// salvo, então o comportamento de edição ao vivo do react-number-format não
// é necessário. Cai nos dígitos crus para qualquer coisa que não pareça um
// telefone completo, em vez de mostrar uma máscara parcial malformada.
export function formatPhoneForDisplay(phone: string): string {
  const digits = sanitizePhoneDigits(phone);

  if (!isCompletePhone(digits)) {
    return digits;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Deep link do wa.me -- mesmo formato +55<dígitos> que o próprio formato de
// link do WhatsApp exige, sem pontuação.
export function buildWhatsAppUrl(phone: string): string {
  return `https://wa.me/55${sanitizePhoneDigits(phone)}`;
}

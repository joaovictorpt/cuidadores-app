// Marcador visual de "este campo é obrigatório" para labels de formulário --
// centralizado para que todo campo obrigatório em todo o app se marque da
// mesma forma.
export function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

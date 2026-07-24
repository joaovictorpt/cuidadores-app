// Visual "this field is required" marker for form labels -- centralized so
// every required field across the app marks itself the same way.
export function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

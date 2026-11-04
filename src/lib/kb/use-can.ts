import { useKb } from "./store";
import type { Perm } from "./access";

export function useCan() {
  const accessRole = useKb((s) => s.accessRole);
  const grants = useKb((s) => s.grants);
  return (perm: Perm | string) => (grants[accessRole] ?? []).includes(perm as Perm);
}

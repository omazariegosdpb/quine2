import { PageLoader } from "@/components/ui/PageLoader";

export default function Loading() {
  // Renderiza dentro del admin layout (Header + tabs visibles arriba).
  return <PageLoader label="Cargando admin…" />;
}

/**
 * Template raíz: a diferencia de `layout.tsx`, este componente RE-MONTA en
 * cada navegación, por lo que la animación `animate-page-fade-in` se ejecuta
 * cada vez que el usuario cambia de ruta. Sin estado ni JS.
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-fade-in">{children}</div>;
}

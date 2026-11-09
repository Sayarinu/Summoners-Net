export function SkipLink({ href = "#main-content" }: { readonly href?: string }) {
  return (
    <a className="np-skip-link" href={href}>
      Skip to main content
    </a>
  );
}

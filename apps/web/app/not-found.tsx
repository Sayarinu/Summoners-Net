import { EmptyState, TextLink } from "@esportsviewer/ui";
export default function NotFound() {
  return (
    <EmptyState
      title="Record not found"
      description={<TextLink href="/search">Search the local library</TextLink>}
    />
  );
}

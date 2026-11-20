import { EmptyState, TextLink } from "@summonersnet/ui";
export default function NotFound() {
  return (
    <EmptyState
      title="Record Not Found"
      description={<TextLink href="/search">Search Teams, Players and Matches</TextLink>}
    />
  );
}

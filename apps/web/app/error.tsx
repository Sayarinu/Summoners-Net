"use client";
import { ErrorState, TextLink } from "@summonersnet/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="This view could not be loaded"
      description={
        <p>
          Check the database connection and filters. <TextLink href="/">Reset filters</TextLink>
        </p>
      }
      onRetry={reset}
    />
  );
}

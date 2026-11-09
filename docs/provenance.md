# Reviewed library provenance

Copied from Sayarinu/Nexus-Pulse at `861cfb846108b3fb4eb3728faff228ac5364da0b`
(M7-StreamsLiveExperience, 2026-09-17). Fresh Git history begins in this repository.

`packages/ui`, `packages/tokens`, their tests, styles, Storybook configuration and generated tokens
were copied in full. Only package import namespaces changed to `@summonersnet`. Typography,
interaction contracts, accessibility behavior and token values are retained. Selected local review
captures are in `docs/reference`; the component implementation is authoritative. Copyright and the
original LICENSE are preserved. Screenshots contain historical example data; they are design
references, never application data.

The old application, database migrations and infrastructure remain in Nexus Pulse. See its
[handoff evidence](https://github.com/Sayarinu/Nexus-Pulse/blob/861cfb846108b3fb4eb3728faff228ac5364da0b/docs/predeployment-implementation.md),
including retired web/worker coverage gaps and unfinished external acceptance.

Layout references: [LoL Esports](https://lolesports.com/en-US), [VLR](https://www.vlr.gg/matches),
[HLTV](https://www.hltv.org/matches). The new application opens directly into filters and grouped
match rows, with persistent desktop navigation and compact mobile navigation. Existing tokens govern
its dark/silver/gold hierarchy.

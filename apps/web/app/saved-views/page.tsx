import { SavedViewsPanel } from "../../src/features/saved-views/panel";

export default function Page() {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">This browser</span>
          <h1>Saved Views</h1>
        </div>
      </header>
      <SavedViewsPanel />
    </div>
  );
}

"use client";

import { useUiScale, type UiScale } from "../../lib/uiScale";

export function FloatingHudSize() {
  const { uiScale, setUiScale } = useUiScale();
  return <label className="casino-hud-size">Floating HUD
    <select value={uiScale} onChange={event => setUiScale(Number(event.target.value) as UiScale)}>
      {[75, 85, 100, 125, 150, 175].map(size => <option key={size} value={size}>{size}%</option>)}
    </select>
  </label>;
}

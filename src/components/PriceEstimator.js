"use client";

import { useState } from "react";

/**
 * The electricity price the savings estimate is multiplied by. Grid rent is
 * included on purpose — solar cuts that too, and leaving it out makes the
 * payback look worse than it is.
 */
export default function PriceEstimator({ onSelect }) {
  const [price, setPrice] = useState(1.5);

  const handleChange = (event) => {
    const value = Number(event.target.value);
    setPrice(value);
    onSelect?.(value);
  };

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="card-title">Din strømpris</span>
        <span className="tag">{price.toFixed(1)} kr/kWh</span>
      </div>

      <input
        type="range"
        min={0.1}
        max={6}
        step={0.1}
        value={price}
        onChange={handleChange}
      />

      <div
        className="flex justify-between text-xs"
        style={{ color: "var(--ink-soft)" }}
      >
        <span>0 kr</span>
        <span>2 kr</span>
        <span>4 kr</span>
        <span>6 kr</span>
      </div>

      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Dra slideren til din gjennomsnittlige pris per kWh, inkludert nettleie.
        Solceller kutter begge deler.
      </p>
    </div>
  );
}

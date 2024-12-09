"use client";

import { useState } from "react";

export default function PriceEstimator({ onSelect }) {
  const [elPrice, setElPrice] = useState(1);

  const handleChange = (event) => {
    const value = event.target.value;
    setElPrice(value);
    if (onSelect) {
      onSelect(value);
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 m-2 mx-auto max-w-lg gap-6 flex flex-col">
      <h1 className="text-center text-xl">
        Din estimerte gjennomsnittlige strømpris.
      </h1>
      <p className="text-center text-orange-500 text-sm">
        Det handle ikke bare om kWh pris - solceller kutter også nettleien.
      </p>
      <p className="text-center text-sm">
        “Dra slideren og estimer gjennomsnittlig (kWh + nettleiepris).”
      </p>
      <input
        type="range"
        min={1}
        max={4}
        step={0.1}
        className="w-full sliderStyling self-center"
        value={elPrice}
        onChange={handleChange}
      />
      <div className="flex flex-row justify-between">
        <p>1 Kr</p>
        <p>2 Kr</p>
        <p>3 Kr</p>
        <p>4 Kr</p>
      </div>
    </div>
  );
}

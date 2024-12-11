"use client";

import { useState } from "react";

export default function PriceEstimator({ onSelect }) {
  const [elPrice, setElPrice] = useState(1.5);

  const handleChange = (event) => {
    const value = event.target.value;
    setElPrice(value);
    if (onSelect) {
      onSelect(value);
    }
  };

  return (
    <div
      className="bg-white rounded-3xl p-4 m-16 mx-auto max-w-lg gap-6 flex flex-col border-4"
      style={{ borderColor: "#FF9D00" }}
    >
      <h1 className="text-center text-xl">
        Din estimerte gjennomsnittlige strømpris.
      </h1>
      <div className="flex flex-row gap-2">
        <img src="/wave.png" className="w-6" />
        <p className="text-center text-orange-500 text-sm">
          Det handle ikke bare om kWh pris - solceller kutter også nettleien.
        </p>
      </div>

      <p className="text-center text-sm">
        “Dra slideren og estimer gjennomsnittlig (kWh + nettleiepris).”
      </p>
      <input
        type="range"
        min={0.1}
        max={6}
        step={0.1}
        className="w-full sliderStyling self-center"
        value={elPrice}
        onChange={handleChange}
      />
      <div className="flex flex-row justify-between">
        <p>0 Kr</p>
        <p>2 Kr</p>
        <p>4 Kr</p>
        <p>6 Kr</p>
      </div>
      <p className="italic text-center">
        Din anslåtte gjennomsnittlige strømpris:{" "}
        <span className="text-red-500">{elPrice}</span> kWh.
      </p>
    </div>
  );
}

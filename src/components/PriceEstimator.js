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
      className="bg-white rounded-3xl p-2 px-8 mx-auto gap-2 flex flex-col border-2 w-full"
      style={{ borderColor: "#FF9D00" }}
    >
      <h1 className="text-center text-lg mb-1">
        Din estimerte gjennomsnittlige strømpris.
      </h1>

      <div className="flex flex-row gap-1 mb-1 items-center">
        <img src="/wave.png" className="w-4 h-4" />
        <p className="text-center text-orange-500 text-md">
          Det handler ikke bare om kWh-pris – solceller kutter også nettleien.
        </p>
      </div>

      <p className="text-center text-md mb-1">
        Dra slideren og estimer gjennomsnittlig (kWh + nettleiepris).
      </p>

      <input
        type="range"
        min={0.1}
        max={6}
        step={0.1}
        className="w-full sliderStyling self-center mb-1"
        value={elPrice}
        onChange={handleChange}
      />

      <div className="flex flex-row justify-between mb-1">
        <p className="text-xs">0 Kr</p>
        <p className="text-xs">2 Kr</p>
        <p className="text-xs">4 Kr</p>
        <p className="text-xs">6 Kr</p>
      </div>

      <p className="italic text-center text-md mt-2">
        Din anslåtte gjennomsnittlige strømpris:{" "}
        <span className="text-red-500">{elPrice}</span> kWh.
      </p>
    </div>
  );
}

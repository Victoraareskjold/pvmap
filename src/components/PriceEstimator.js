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
      className="bg-white rounded-3xl p-4 m-16 mx-auto max-w-lg gap-3 flex flex-col border-2 h-[280px]"
      style={{ borderColor: "#FF9D00" }}
    >
      <h1 className="text-center text-xl mb-1">
        Din estimerte gjennomsnittlige strømpris.
      </h1>

      {/* Reduced margin and adjusted the text size */}
      <div className="flex flex-row gap-2 mb-2">
        <img src="/wave.png" className="w-5 h-5" />
        <p className="text-center text-orange-500 text-xs">
          Det handle ikke bare om kWh pris - solceller kutter også nettleien.
        </p>
      </div>

      {/* Reduced margin */}
      <p className="text-center text-xs mb-2">
        “Dra slideren og estimer gjennomsnittlig (kWh + nettleiepris).”
      </p>
      
      {/* Adjusted the spacing of the slider */}
      <input
        type="range"
        min={0.1}
        max={6}
        step={0.1}
        className="w-full sliderStyling self-center mb-2"
        value={elPrice}
        onChange={handleChange}
      />
      
      {/* Adjusted the space between the Kr values */}
      <div className="flex flex-row justify-between mb-2">
        <p className="text-xs">0 Kr</p>
        <p className="text-xs">2 Kr</p>
        <p className="text-xs">4 Kr</p>
        <p className="text-xs">6 Kr</p>
      </div>
      
      {/* Moved the final text slightly up */}
      <p className="italic text-center text-xs mt-1">
        Din anslåtte gjennomsnittlige strømpris:{" "}
        <span className="text-red-500">{elPrice}</span> kWh.
      </p>
    </div>
  );
}



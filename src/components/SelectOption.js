"use client";

import { useState } from "react";

export default function SelectOption({ title, options = [], onSelect }) {
  const [selected, setSelected] = useState(options[0] || "");

  const handleChange = (event) => {
    setSelected(event.target.value);
    onSelect?.(event.target.value);
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="card-title">{title}</span>
      <select className="field" value={selected} onChange={handleChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

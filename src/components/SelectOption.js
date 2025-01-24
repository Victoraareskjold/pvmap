"use client";

import { useState } from "react";

export default function SelectOption({ title, options = [], onSelect }) {
  const [selectedOption, setSelectedOption] = useState(options[0] || "");

  const handleChange = (event) => {
    const value = event.target.value;
    setSelectedOption(value);
    if (onSelect) {
      onSelect(value);
    }
  };

  return (
    <div className="flex flex-row gap-2">
      <label className="min-w-20 xl:min-w-0">{title}</label>
      <select
        id="optionContainer"
        className="border border-orange-500 rounded-md p-1 text-sm w-52"
        value={selectedOption}
        onChange={handleChange}
      >
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

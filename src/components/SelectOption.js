"use client";

export default function SelectOption({ title, options = [] }) {
  return (
    <div className="flex flex-row gap-2">
      <label>{title}</label>
      <select
        id="optionContainer"
        className="border border-orange-500 rounded-md p-1"
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

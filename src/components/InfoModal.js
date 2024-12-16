"use client";
import React from "react";

export default function InfoModal({ isOpen, onClose, content }) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-20"
        onClick={onClose} // Lukker modal ved klikk på overlay
      ></div>
      <div
        className="absolute bottom-20 z-50 border rounded-xl "
        style={{ background: "#FFEADA", borderColor: "#000000" }}
      >
        <div className="flex flex-col p-2 gap-2">
          <button className="self-end" onClick={onClose}>
            Lukk
          </button>
          <p>{content}</p>
        </div>
      </div>
    </>
  );
}

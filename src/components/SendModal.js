"use client";
import { useState } from "react";
import emailjs from "@emailjs/browser";
import { getLocalStorage } from "../../utils/localstorage";

export default function SendModal({
  checkedRoofData,
  selectedElPrice,
  selectedRoofType,
  selectedPanelType,
  totalPanels,
  yearlyCost,
  yearlyCost2,
  yearlyProd,
  address,
  toggleModal,
  site,
  desiredKWh,
  coveragePercentage,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [checked, setChecked] = useState(true);
  const [loading, setLoading] = useState(false);

  const [selectedEquipment, setSelectedEquipment] = useState("Solcelleanlegg");

  const handleNameChange = (e) => setName(e.target.value);
  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePhoneChange = (e) => setPhone(e.target.value);
  const handleCheckChange = (e) => setChecked(e.target.checked);

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (site !== "solarinstallationdashboard") {
      if (checkedRoofData.length === 0) {
        alert("Velg minst 6 paneler!");
        setLoading(false);
        return;
      }
      if (!email.trim()) {
        setLoading(false);
        return;
      }
      if (!checked) {
        alert("Vennligst huk av boksen også.");
        setLoading(false);
        return;
      }
    }

    const gclid = getLocalStorage("gclid") ?? "";
    const fbclid = getLocalStorage("fbclid") ?? "";
    const utmCampaign = getLocalStorage("utmCampaign") ?? "";

    const payload = {
      site,
      checked: checked ? "Ja" : "Nei",
      user_address: address,
      user_name: name,
      user_phone: phone,
      user_email: email,
      user_equipment: selectedEquipment,
      user_comment: comment,
      gclid,
      fbclid,
      utmCampaign,
      selectedRoofType,
      selectedPanelType,
      selectedElPrice,
      totalPanels,
      yearlyCost: Number(yearlyCost?.toFixed(0)) || "Ikke tilgjengelig",
      yearlyCost2: Number(yearlyCost2?.toFixed(0)) || "Ikke tilgjengelig",
      yearlyProd: Number(yearlyProd?.toFixed(0)) || "Ikke tilgjengelig",
      checkedRoofData: checkedRoofData || [],
      desiredKWh,
      coveragePercentage,
    };

    const checkedRoofDataFormatted = checkedRoofData
      .map(
        (r) =>
          `TakID: ${r.roofId}, Justerte paneler: ${r.adjustedPanelCount}, Max paneler: ${r.maxPanels}, Retning: ${r.direction}, Vinkel: ${r.angle.toFixed(2)}`,
      )
      .join("\n");

    try {
      if (site === "solarinstallationdashboard") {
        window.parent.postMessage({ type: "PVMAP_DATA", payload }, "*");
        return;
      }

      await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await emailjs.send(
        process.env.NEXT_PUBLIC_SERVICE_ID,
        process.env.NEXT_PUBLIC_TEMPLATE_ID,
        { ...payload, checkedRoofData: checkedRoofDataFormatted },
        process.env.NEXT_PUBLIC_PUBLIC_KEY,
      );
      console.log("✅ E-post sendt:", res);
      window.top.location.href = `https://www.${site}.no/takk`;
    } catch (error) {
      console.error("❌ Feil ved sending:", error);
      alert("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const equipmentChoice = [
    {
      label: "Solcelleanlegg",
      imageUrl: "/icon1.png",
    },
    {
      label: "Batteri",
      imageUrl: "/icon2.png",
    },
    {
      label: "Solcelleanlegg + Batteri",
      imageUrl: "/icon3.png",
    },
  ];

  return (
    <form className="flex flex-col gap-3 bg-white rounded-xl modal z-50 p-6 w-full max-w-md fixed max-h-[90vh] overflow-y-auto">
      <button
        className="absolute top-4 right-4 text-red-500 text-xl"
        type="button"
        onClick={toggleModal}
      >
        ×
      </button>
      <h2 className="text-xl font-bold mb-4">
        Fyll ut dine detaljer for et uforpliktende tilbud på e-post.
      </h2>

      <div className="flex flex-row justify-between w-full gap-2">
        {equipmentChoice.map((choice) => {
          const isSelected = selectedEquipment === choice.label;

          return (
            <button
              type="button"
              key={choice.label}
              onClick={() => setSelectedEquipment(choice.label)}
              className={`p-2 rounded-lg shadow-xl w-full transition border-2
          ${
            isSelected
              ? "border-[#FFC25F] ring-2 ring-[#FFC25F]"
              : "border-transparent hover:border-gray-300"
          }`}
            >
              <p className="font-medium">{choice.label}</p>
              <img
                src={choice.imageUrl}
                className="mx-auto object-contain py-2"
              />
            </button>
          );
        })}
      </div>

      <div>
        <label className="block text-sm font-medium">Fullt navn*</label>
        <input
          className="w-full border rounded-md px-3 py-2 bg-zinc-200"
          placeholder="Fornavn Etternavn"
          value={name}
          onChange={handleNameChange}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Telefon*</label>
        <input
          className="w-full border rounded-md px-3 py-2 bg-zinc-200"
          placeholder="Telefonnummer"
          value={phone}
          onChange={handlePhoneChange}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">E-post*</label>
        <input
          className="w-full border rounded-md px-3 py-2 bg-zinc-200"
          type="email"
          placeholder="Din E-postaddresse"
          value={email}
          onChange={handleEmailChange}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Kommentar</label>
        <textarea
          type="text"
          className="w-full border rounded-md px-3 py-2 bg-zinc-200"
          value={comment}
          placeholder="Kommentar"
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="flex flex-row gap-2">
        <input type="checkbox" checked={checked} onChange={handleCheckChange} />
        <p className="text-sx">
          Jeg godtar at informasjonen brukes kun til å sende tilbud på
          solcellepaneler via e-post og eventuelt kontakte meg på mobil.
        </p>
      </div>
      <button
        className="bg-red-500 self-center !w-full py-1 rounded-md text-sm funky !mt-0"
        onClick={handleSend}
        disabled={loading}
      >
        {loading ? "Sender..." : "Jeg ønsker uforpliktende tilbud"}
      </button>
      <p className="italic">
        Få et estimat som gir deg en oversikt over årlige inntekter og
        tilgjengelig offentlig støtte. Investering i solcellepaneler har nylig
        blitt mye mer lønnsomt, noe som kan overraske deg positivt.
      </p>
    </form>
  );
}

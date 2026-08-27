"use client";
import { useState } from "react";
import emailjs from "@emailjs/browser";
import { getLocalStorage } from "../../utils/localstorage";
import { useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();

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

    const gclid = searchParams.get("gclid") ?? getLocalStorage("gclid") ?? "";
    const fbclid =
      searchParams.get("fbclid") ?? getLocalStorage("fbclid") ?? "";
    const utmCampaign =
      searchParams.get("utm_campaign") ?? getLocalStorage("utmCampaign") ?? "";

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
    <form className="card modal z-50 flex max-h-[90vh] w-[min(28rem,92vw)] flex-col gap-4 overflow-y-auto p-6">
      <button
        className="absolute right-4 top-4 text-2xl leading-none"
        style={{ color: "var(--ink-soft)" }}
        type="button"
        onClick={toggleModal}
      >
        ×
      </button>

      <h2 className="pr-8 text-xl font-semibold">
        Få et uforpliktende tilbud på e-post
      </h2>

      <div className="flex w-full flex-row gap-2">
        {equipmentChoice.map((choice) => {
          const isSelected = selectedEquipment === choice.label;

          return (
            <button
              type="button"
              key={choice.label}
              onClick={() => setSelectedEquipment(choice.label)}
              className="flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-sm transition"
              style={{
                borderColor: isSelected ? "var(--accent)" : "var(--line)",
                background: isSelected ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <img src={choice.imageUrl} className="h-10 object-contain" alt="" />
              <span className="font-medium leading-tight">{choice.label}</span>
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="card-title">Fullt navn*</span>
        <input
          className="field"
          placeholder="Fornavn Etternavn"
          value={name}
          onChange={handleNameChange}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="card-title">Telefon*</span>
        <input
          className="field"
          placeholder="Telefonnummer"
          value={phone}
          onChange={handlePhoneChange}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="card-title">E-post*</span>
        <input
          className="field"
          type="email"
          placeholder="din@epost.no"
          value={email}
          onChange={handleEmailChange}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="card-title">Kommentar</span>
        <textarea
          className="field"
          rows={3}
          value={comment}
          placeholder="Noe vi bør vite?"
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <label className="flex flex-row gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          checked={checked}
          onChange={handleCheckChange}
        />
        <span style={{ color: "var(--ink-soft)" }}>
          Jeg godtar at informasjonen brukes til å sende tilbud på
          solcellepaneler via e-post, og eventuelt kontakte meg på mobil.
        </span>
      </label>

      <button
        className="btn btn-primary w-full"
        onClick={handleSend}
        disabled={loading}
      >
        {loading ? "Sender…" : "Jeg ønsker uforpliktende tilbud"}
      </button>
    </form>
  );
}

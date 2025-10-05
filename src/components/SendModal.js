"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import emailjs from "@emailjs/browser";

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
  const [checked, setChecked] = useState(true);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleNameChange = (e) => setName(e.target.value);
  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePhoneChange = (e) => setPhone(e.target.value);
  const handleCheckChange = (e) => setChecked(e.target.checked);

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);

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

    const templateParams = {
      name,
      email,
      phone,
      address,
      site,
      checked: checked ? "Ja" : "Nei",
      selectedRoofType,
      selectedPanelType,
      selectedElPrice,
      totalPanels,
      yearlyCost: yearlyCost?.toFixed(0) || "Ikke tilgjengelig",
      yearlyCost2: yearlyCost2?.toFixed(0) || "Ikke tilgjengelig",
      yearlyProd: yearlyProd?.toFixed(0) || "Ikke tilgjengelig",
      checkedRoofData: checkedRoofData || [],
      desiredKWh,
      coveragePercentage,
    };

    try {
      if (site === "solarinstallationdashboard") {
        window.parent.postMessage(
          { type: "PVMAP_DATA", payload: templateParams },
          "*"
        );
        return;
      }

      const res = await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        templateParams,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
      );

      console.log("✅ E-post sendt:", res.text);
      window.top.location.href = `https://www.${site}.no/takk`;
    } catch (error) {
      console.error("❌ Feil ved sending:", error);
      alert("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSend}
      className="flex flex-col gap-3 bg-white rounded-xl modal z-50 p-4 w-full max-w-md fixed"
    >
      <button
        className="absolute top-4 right-4 text-red-500 text-xl"
        onClick={toggleModal}
      >
        ×
      </button>
      <p className="text-md w-5/6">
        Informasjonen du har fylt ut i solkartet, sendes automatisk til oss.
        Mangler noe, går det fint – vi lager et forslag som passer best for deg.
        Fyll ut resten nedenfor for et uforpliktende tilbud.
      </p>

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

      <div className="flex flex-row gap-2">
        <input type="checkbox" checked={checked} onChange={handleCheckChange} />
        <p>
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

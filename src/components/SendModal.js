"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleNameChange = (e) => setName(e.target.value);
  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePhoneChange = (e) => setPhone(e.target.value);
  const handleCheckChange = (e) => setChecked(!checked);

  const handleSend = async () => {
    setLoading(true);

    if (checkedRoofData.length === 0) {
      alert("Velg minst 6 paneler!");
      setLoading(false);
      return;
    }

    if (email.trim() == "") {
      alert("Vennligst skriv inn din e-postadresse.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/sendMail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          checked,
          checkedRoofData,
          selectedElPrice,
          selectedRoofType,
          selectedPanelType,
          totalPanels,
          yearlyCost,
          yearlyCost2,
          yearlyProd,
          address,
          site,
        }),
      });

      if (response.ok) {
        alert("Takk, du vil straks motta ditt estimat!");
        window.top.location.href = `https://www.${site}no/takk`;
      } else {
        console.error(error, "ved sending");
        alert("Noe gikk galt. Vennligst prøv igjen.");
      }
    } catch (error) {
      alert("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 bg-white rounded-xl modal z-50 p-4 w-full max-w-md fixed">
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
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Telefon*</label>
        <input
          className="w-full border rounded-md px-3 py-2 bg-zinc-200"
          placeholder="Telefonnummer"
          value={phone}
          onChange={handlePhoneChange}
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
        />
      </div>

      <div className="flex flex-row gap-2">
        <input type="checkbox" value={checked} onChange={handleCheckChange} />
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
    </div>
  );
}

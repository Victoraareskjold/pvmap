import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SendModal({
  checkedRoofData,
  selectedElPrice,
  selectedRoofType,
  selectedPanelType,
  totalPanels,
  yearlyCost,
  yearlyProd,
  address,
  toggleModal,
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
          yearlyProd,
          address,
        }),
      });

      if (response.ok) {
        alert("Takk, du vil straks motta ditt estimat!");
        router.push("/");
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
    <div className="flex flex-col gap-6 bg-white rounded-xl modal z-50 p-4 w-full max-w-md">
      <button
        className="self-end text-orange-500 font-bold text-sm"
        onClick={toggleModal}
      >
        Lukk
      </button>
      <h1 className="font-bold text-2xl">
        Er du klar til å se hvor mye du kan spare?
      </h1>
      <p className="text-md">
        Få et estimat som gir deg en oversikt over årlige inntekter og
        tilgjengelig offentlig støtte. Investering i solcellepaneler har nylig
        blitt mye mer lønnsomt, noe som kan overraske deg positivt.
      </p>
      <h2 className="font-semibold">
        Fyll ut detaljer for et uforpliktende estimat på e-post
      </h2>
      <input
        className="border-2 border-slate-300 p-1 rounded-md"
        placeholder="Ditt Navn"
        value={name}
        onChange={handleNameChange}
      />
      <input
        className="border-2 border-slate-300 p-1 rounded-md"
        placeholder="Telefonnummer"
        value={phone}
        onChange={handlePhoneChange}
      />
      <input
        className="border-2 border-slate-300 p-1 rounded-md"
        type="email"
        placeholder="Din E-postaddresse"
        value={email}
        onChange={handleEmailChange}
      />
      <div className="flex flex-row gap-2">
        <input type="checkbox" value={checked} onChange={handleCheckChange} />
        <p>
          For å sikre at prisestimatet blir korrekt, vil vi ringe deg hvis vi
          trenger mer informasjon.
        </p>
      </div>
      <button
        className="bg-orange-500 rounded-xl p-1 text-white font-bold"
        onClick={handleSend}
        disabled={loading}
      >
        {loading ? "Sender..." : "Kom i gang"}
      </button>
    </div>
  );
}

"use client";
import { useState } from "react";
import emailjs from "@emailjs/browser";
import { getLocalStorage } from "../../utils/localstorage";
import { useSearchParams } from "next/navigation";

const nb = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n || 0));

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
  const [step, setStep] = useState(1);

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

  /* Ikonene er inline SVG framfor de gamle PNG-ene: de arver tekstfargen, så
     et valgt kort kan farge ikonet oransje uten en egen bildefil, og de
     holder samme strektykkelse i alle tre valgene. */
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    className: "h-7 w-7 shrink-0",
  };

  const equipmentChoice = [
    {
      label: "Solcelleanlegg",
      description: "Produser din egen strøm",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
        >
          <title>Solcelleanlegg</title>
          <circle cx="36" cy="36" r="31" fill="#FFF3D8" />
          <g stroke="#FFB230" stroke-width="2.2" stroke-linecap="round">
            <path d="M53 8v3M53 25v3M43 18h-3M66 18h-3M46 11l-2-2M62 27l-2-2M60 11l2-2M44 27l2-2" />
          </g>
          <circle cx="53" cy="18" r="6.5" fill="#FFB230" />
          <g transform="rotate(-5 34 42)">
            <rect
              x="13"
              y="29"
              width="42"
              height="25"
              rx="4.5"
              fill="#263D57"
            />
            <path
              d="M27 29v25M41 29v25M13 37.3h42M13 45.7h42"
              stroke="#7897B7"
              stroke-width="1.35"
            />
            <rect
              x="14"
              y="30"
              width="40"
              height="23"
              rx="3.5"
              stroke="#15283D"
              stroke-width="1.5"
            />
          </g>
          <path
            d="M33 55v5M26 61h14"
            stroke="#263D57"
            stroke-width="2.6"
            stroke-linecap="round"
          />
        </svg>
      ),
    },
    {
      label: "Batteri",
      description: "Lagre og styr strømmen",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
        >
          <title>Batteri</title>
          <circle cx="36" cy="36" r="31" fill="#EAF9F1" />
          <rect x="28" y="9" width="16" height="7" rx="3" fill="#263D57" />
          <rect
            x="17"
            y="13"
            width="38"
            height="48"
            rx="10"
            fill="#FFFFFF"
            stroke="#263D57"
            stroke-width="2.2"
          />
          <rect x="22" y="19" width="28" height="36" rx="7" fill="#42CA89" />
          <path
            d="m38.5 25-9 14h7l-3 10 10-16h-7l2-8Z"
            fill="#FFFFFF"
            stroke="#FFFFFF"
            stroke-linejoin="round"
          />
          <path
            d="M27 55h18"
            stroke="#16945D"
            stroke-width="1.6"
            stroke-linecap="round"
            opacity=".55"
          />
        </svg>
      ),
    },
    {
      label: "Solcelleanlegg + Batteri",
      description: "Produksjon og lagring samlet",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
        >
          <title>Solceller og batteri</title>
          <circle cx="36" cy="36" r="31" fill="#EDF4FF" />
          <circle cx="20" cy="18" r="6" fill="#FFB230" />
          <g stroke="#FFB230" stroke-width="1.8" stroke-linecap="round">
            <path d="M20 8v2M20 26v2M10 18H8M32 18h-2M13 11l-1.5-1.5M28.5 26.5 27 25M27 11l1.5-1.5M11.5 26.5 13 25" />
          </g>
          <g transform="rotate(-5 25 39)">
            <rect x="8" y="29" width="34" height="22" rx="4" fill="#263D57" />
            <path
              d="M19.3 29v22M30.7 29v22M8 36.3h34M8 43.7h34"
              stroke="#7897B7"
              stroke-width="1.15"
            />
          </g>
          <path
            d="M26 52v5h18c3 0 5-2 5-5v-2"
            stroke="#FFB230"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="46" y="20" width="11" height="5" rx="2" fill="#263D57" />
          <rect
            x="41"
            y="23"
            width="21"
            height="34"
            rx="6"
            fill="#FFFFFF"
            stroke="#263D57"
            stroke-width="2"
          />
          <rect x="45" y="28" width="13" height="24" rx="3.5" fill="#42CA89" />
          <path d="m52.5 32-4.5 8h4l-2 7 5-9h-4l1.5-6Z" fill="#FFFFFF" />
        </svg>
      ),
    },
  ];

  /* Oppsummeringen bruker tallene brukeren allerede står og ser på i
     sidepanelet. Å gjenta dem her er det som gjør skjemaet til siste steg i
     en beregning framfor et løsrevet kontaktskjema. */
  const summary = [
    { label: "Paneler", value: totalPanels ? `${totalPanels} stk` : null },
    {
      label: "Produksjon",
      value: yearlyProd ? `${nb(yearlyProd)} kWh/år` : null,
    },
    {
      label: "Årlig kostnad",
      value: yearlyCost ? `${nb(yearlyCost)} kr` : null,
    },
  ].filter((s) => s.value);

  return (
    <form
      onSubmit={handleSend}
      /* Dashboardet har sin egen tidlige exit i handleSend og har aldri gått
         gjennom nettleservalidering — den slås av der for å ikke endre en
         flyt som virker. */
      noValidate={site === "solarinstallationdashboard"}
      className="card modal flex max-h-[90vh] w-[min(30rem,94vw)] flex-col overflow-hidden"
    >
      {/* Topp — blir stående mens resten scroller */}
      <header
        className="shrink-0 border-b px-6 pb-5 pt-5"
        style={{
          borderColor: "var(--line)",
          background:
            "linear-gradient(180deg, var(--accent-soft) 0%, var(--surface) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-dark)",
            }}
          >
            Steg {step} av 2
          </span>
          <button
            type="button"
            onClick={toggleModal}
            aria-label="Lukk"
            className="-mr-1 -mt-1 shrink-0 rounded-full px-2 text-2xl leading-none transition-colors hover:bg-black/5"
            style={{ color: "var(--ink-soft)" }}
          >
            ×
          </button>
        </div>

        <h2 className="mt-2.5 text-xl font-semibold leading-tight">
          {step === 1
            ? "Hva ønsker du tilbud på?"
            : "Hvor skal vi sende tilbudet?"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
          {step === 1
            ? "Velg løsningen som passer best. Du kan endre valget senere."
            : "Fyll inn kontaktinformasjonen, så lager vi en tilpasset vurdering."}
        </p>

        {address && <p className="mt-1 text-sm font-medium">{address}</p>}

        {summary.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {summary.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border px-2 py-2 text-center"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--surface)",
                }}
              >
                <p className="card-title !text-[10px]">{s.label}</p>
                <p className="mt-0.5 text-sm font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Innhold */}
      <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
        {step === 1 ? (
          /* Kortene ligger som rader og ikke i tre kolonner: modalen er
             maks 30rem bred, og der får ikke en forklarende undertekst
             plass ved siden av to andre kort uten å brekke stygt. */
          <div className="flex flex-col gap-2.5">
            {equipmentChoice.map((choice) => {
              const isSelected = selectedEquipment === choice.label;

              return (
                <button
                  type="button"
                  key={choice.label}
                  onClick={() => setSelectedEquipment(choice.label)}
                  aria-pressed={isSelected}
                  className="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition"
                  style={{
                    borderColor: isSelected ? "var(--accent)" : "var(--line)",
                    background: isSelected
                      ? "var(--accent-soft)"
                      : "var(--surface)",
                    color: isSelected ? "var(--accent-dark)" : "inherit",
                  }}
                >
                  {choice.icon}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold leading-tight">
                      {choice.label}
                    </span>
                    <span
                      className="mt-0.5 text-xs"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {choice.description}
                    </span>
                  </span>

                  {/* Hakeikonet ligger i et fast felt til høyre, slik at
                      radhøyden ikke endrer seg når valget flyttes. */}
                  <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center">
                    {isSelected && (
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className="h-5 w-5"
                      >
                        <path d="m4.5 10.5 3.6 3.6 7.4-8" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent-dark)",
                }}
              >
                Valgt: {selectedEquipment}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm underline underline-offset-2"
                style={{ color: "var(--ink-soft)" }}
              >
                Endre valg
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="card-title">Fullt navn*</span>
              <input
                className="field"
                placeholder="Fornavn Etternavn"
                value={name}
                onChange={handleNameChange}
                autoComplete="name"
                required
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="card-title">Telefon*</span>
                <input
                  className="field"
                  type="tel"
                  placeholder="Telefonnummer"
                  value={phone}
                  onChange={handlePhoneChange}
                  autoComplete="tel"
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
                  autoComplete="email"
                  required
                />
              </label>
            </div>

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

            <label
              className="flex flex-row gap-2.5 rounded-xl border p-3 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--bg)" }}
            >
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
          </>
        )}
      </div>

      {/* Bunn — knappen skal være innen rekkevidde uten å scrolle */}
      <footer
        className="shrink-0 border-t px-6 pb-5 pt-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        {step === 1 ? (
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn btn-primary w-full"
          >
            Gå videre
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-secondary"
            >
              Tilbake
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Sender…" : "Få et uforpliktende tilbud"}
            </button>
          </div>
        )}
        <p
          className="mt-2.5 text-center text-xs"
          style={{ color: "var(--ink-soft)" }}
        >
          Gratis vurdering · Ingen binding · Tilpasset beregning
        </p>
      </footer>
    </form>
  );
}

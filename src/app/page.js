"use client";

import AddressSearch from "@/components/AddressSearch";

const STEPS = [
  {
    title: "Søk opp adressen din",
    body: "Vi henter taket ditt fra Googles takanalyse, eller lar deg tegne det selv om taket ikke er kartlagt.",
  },
  {
    title: "Velg takflater og paneler",
    body: "Hver flate fargelegges etter hvor godt den egner seg. Du justerer antall paneler selv.",
  },
  {
    title: "Se produksjon og pris",
    body: "Produksjonen regnes ut med PVGIS-data, og du får et estimat på kostnad og besparelse.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-5 py-10 lg:justify-center lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Tekst og søk */}
          <div className="flex flex-col gap-6">
            <span className="tag w-fit">Gratis og uforpliktende</span>

            <h1 className="text-4xl leading-tight md:text-5xl">
              Finn ut om solenergi passer{" "}
              <span style={{ color: "var(--accent-dark)" }}>ditt tak</span>.
            </h1>

            <p
              className="max-w-xl text-lg"
              style={{ color: "var(--ink-soft)" }}
            >
              Skriv inn adressen din, så viser vi takflatene dine, hvor mye
              strøm de kan produsere og hva et anlegg vil koste. Utforsk i ditt
              eget tempo — vi tar ikke kontakt før du ber om det.
            </p>

            <AddressSearch variant="hero" autoFocus />

            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Produksjonstall er beregnet med PVGIS (EU-kommisjonen), basert på
              måledata fra 2005–2020.
            </p>
          </div>

          {/* Bilde */}
          <div
            className="card overflow-hidden"
            style={{ aspectRatio: "4 / 3" }}
          >
            <img
              src="/solarIllustration.jpg"
              alt="Solcelleanlegg på tak"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Slik fungerer det */}
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card flex flex-col gap-2 p-5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent-dark)",
                }}
              >
                {i + 1}
              </span>
              <h2 className="text-base font-semibold">{step.title}</h2>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

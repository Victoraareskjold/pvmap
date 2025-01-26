"use client";
import Searchbar from "@/components/Searchbar";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const site = searchParams.get("site");

  return (
    <div
      className="flex flex-col w-screen h-screen"
      style={{ backgroundColor: "#6697CA" }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center w-full h-full max-w-[120rem] self-center">
        {/* Tekstdelen */}
        <div className="flex flex-col justify-center items-start px-4 md:px-12 gap-2 pt-4 lg:pt-0 lg:gap-8 h-1/2 lg:w-1/2">
          <h1 className="text-white text-3xl md:text-6xl">
            Utforsk mulighetene – Finn ut om solenergi passer for deg.
          </h1>
          <p className="text-white text-md md:text-xl max-w-2xl">
            Skriv inn adressen din og se hvilken løsning som passer deg best.
            Utforsk i ditt eget tempo, og om du lurer på noe, er vi bare en
            melding unna – helt uforpliktende.
          </p>
          <Searchbar site={site} />
        </div>

        {/* Bildedelen */}
        <div className="flex h-1/2 lg:w-1/2">
          <img
            src="/solarIllustration.jpg"
            alt="Solar Illustration"
            className="object-contain w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

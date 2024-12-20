"use client";
import Searchbar from "@/components/Searchbar";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const site = searchParams.get("site");
  return (
    <div className="background">
      <div className="px-4 md:px-12 xl:px-12 w-full self-center flex flex-col gap-8 max-w-7xl">
        <h1 className="text-white text-6xl">
          Er solceller en god <br /> investering for deg?
        </h1>
        <p className="text-white text-xl max-w-2xl">
          Skriv inn adressen din og se hvilken løsning som passer deg best.
          Utforsk i ditt eget tempo, og om du lurer på noe, er vi bare en
          melding unna – helt uforpliktende.
        </p>
        <Searchbar site={site} />
      </div>
    </div>
  );
}

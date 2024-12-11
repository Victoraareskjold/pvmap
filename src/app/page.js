import Searchbar from "@/components/Searchbar";

export default function Home() {
  return (
    <div className="background">
      <div className="px-12 w-full self-center flex flex-col gap-8">
        <h1 className="text-white text-6xl">
          Er solceller en god <br /> investering for deg?
        </h1>
        <p className="text-white text-xl max-w-2xl">
          Skriv inn adressen din og se hvilken løsning som passer deg best.
          Utforsk i ditt eget tempo, og om du lurer på noe, er vi bare en
          melding unna – helt uforpliktende.
        </p>
        <Searchbar />
      </div>
    </div>
  );
}

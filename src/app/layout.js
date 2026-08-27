import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import HandleQueryParams from "@/components/HandleQueryParams";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Solkart — se hva taket ditt kan produsere",
  description:
    "Søk opp adressen din og se takflater, produksjon og pris på et solcelleanlegg.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="nb">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense>
          <HandleQueryParams />
          {children}
        </Suspense>
      </body>
    </html>
  );
}

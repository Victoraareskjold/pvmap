# pvmap + Google Solar API — plan

Grunnprinsipp: **hver kilde gjør det den er best på.** Google erstatter ikke Norkart og ikke PVGIS. Google fyller hullet ingen av dem dekker — faktisk skygge — og legger til et salgsargument ingen konkurrent i Norge har.

---

## Hva dagens pvmap mangler

| | Har i dag | Mangler |
|---|---|---|
| Takflate-geometri | Norkart `takflater/matrikkel/{id}` — polygon, retning, helning, 3D-areal | — |
| Produksjon | PVGIS per flate | **Antar uskygget tak.** Naboer, trær, egne oppbygg ignoreres |
| Panellayout | Estimert fra areal | Faktisk plassering |
| Lead-kvalifisering | — | **Vet ikke om huset alt har solceller** |
| Visuelt | Flatefarge etter retning/helning | Ekte solinnstråling |

De tre hullene lukkes av Google. Geometrien beholder du fra Norkart, fordi Google ikke gir polygoner.

---

## Arkitektur

```
Geonorge/Norkart søk  →  addressId + lat/lng
        │
        ├─ Norkart takflater  →  polygon, Retning, Helning, Areal3D   [behold]
        │
        ├─ Google buildingInsights:findClosest
        │     ├─ solarPanels[]        → faktisk panellayout
        │     ├─ roofSegmentStats[]   → kryss-sjekk mot Norkart
        │     └─ detectedArrays[]     → har huset alt anlegg?        [nytt, GA 11. mai 2026]
        │
        ├─ Google dataLayers:get (radius 30 m)
        │     └─ annualFlux.tif       → kWh/m²/år per piksel
        │
        └─ PVGIS per flate  →  produksjon  ×  skyggefaktor fra flux   [behold]
```

### Skyggekorreksjonen — kjernen i «MYE bedre»

1. Hent `annualFluxUrl`, last ned GeoTIFF med `geotiff.js`, reprojiser med `proj4` til WGS84
2. For hver Norkart-takflate: plukk fluxpikslene som ligger inne i polygonet, ta medianen → `fluxMålt` (kWh/m²/år)
3. Hent PVGIS-referanse for samme lat/lng, helning og retning → `fluxIdeell`
4. `skyggefaktor = clamp(fluxMålt / fluxIdeell, 0, 1)`
5. `produksjon = PVGIS_AC × skyggefaktor`

Resultatet er fortsatt PVGIS-forankret — altså forsvarbart i et tilbud — men korrigert for virkeligheten. En takflate bak en granskog får ikke lenger samme tall som en fri flate.

Dette er også kvalitetskontrollen din: er `skyggefaktor` under ~0,5 er flaten reelt uegnet, og det bør sies til kunden før befaring i stedet for etter.

---

## Rekkefølge

**Fase 0 — beslutningsgrunnlag (blokkerer alt annet)**
Opprett API-nøkkel i Google Cloud, aktiver Solar API, legg `GOOGLE_SOLAR_API_KEY` i `.env.local`. Kjør `node scripts/test-solar-coverage.mjs`.

Skriptet er nå oppdatert til å svare på de tre spørsmålene som avgjør resten:

- Hvilken `imageryQuality` får Norge? HIGH (0,1 m/pixel) gjør skyggekorreksjonen presis, BASE (0,25 m) gjør den grov men brukbar. Norge er ikke nevnt i noen av Googles utvidelsesnotater fra 2025–2026, så dette må måles, ikke antas.
- Returnerer `dataLayers` faktisk `annualFluxUrl` for norske adresser? Uten den faller hele fase 2 bort.
- Hvor mange av testadressene har alt solceller ifølge `detectedArrays`?

Kostnad: ~23 kall, godt innenfor gratiskvoten.

**Fase 1 — Detected Arrays** (liten, isolert, umiddelbar verdi)
Ett ekstra felt i `buildingInsights`-kallet. Flagg leads der taket alt har anlegg. Sparer selgertid fra dag én og krever ingen rasterbehandling.

**Fase 2 — Skyggekorreksjon**
Serverside route `/api/solar-flux` som henter GeoTIFF, klipper mot Norkart-polygonene og returnerer skyggefaktor per flate. Cache på `addressId` — fluxen endrer seg ikke mellom to henvendelser, og Data Layers er den dyre delen.

**Fase 3 — Visuelt fluxkart**
Rendre `annualFlux` til canvas med fargeramp, klippet til takflatene, som Leaflet-overlay. Erstatter dagens kategorifarger med ekte data. Rent salgsargument.

**Fase 4 — Google som fallback**
Der Norkart mangler takflater: bruk Googles `roofSegmentStats` + panelgruppering per `segmentIndex` for et grovt estimat i stedet for tom skjerm.

---

## Kostnad

| SKU | Ca. pris | Bruk |
|---|---|---|
| Building Insights | ~$10 / 1000 | 1 per adressesøk |
| Data Layers | ~$75 / 1000 | 1 per adresse, **cache hardt** |

Første 1000 kall/mnd per SKU er gratis. Data Layers er det som kan løpe løpsk — uten cache blir 500 søk i måneden ~$37. Med cache per `addressId` betaler du én gang per bygg, for alltid. Verifiser gjeldende priser i Cloud Console før dere skalerer; tallene over er omtrentlige.

Kostnadskuttet ligger uansett ikke her, men i søket: `/api/search` bruker Norkarts fritekstsøk som dere betaler for, mens `ws.geonorge.no/adresser/v1/sok` er gratis. Testskriptet bruker allerede Geonorge, så mønsteret er verifisert. Det som må testes er om `takflater/matrikkel/{id}` godtar en ID satt sammen av matrikkelfeltene Geonorge returnerer.

---

## To ting å være klar over

**EEA-tilpasning gjelder Norge.** Fra 8. juli 2025 returnerer `buildingInsights` ikke lenger `postalCode`, `administrativeArea` eller `regionCode` for EØS-koblede prosjekter. Ingen av dem brukes i pvmap i dag, så det er uproblematisk — men ikke bygg noe som forutsetter dem.

**Ikke bruk Googles produksjonstall direkte.** En uavhengig sammenligning fant `yearlyEnergyDcKwh` rundt 77 % over fysikkbasert modellering, og detektert takareal ~30 % for stort. Bruk Google til geometri, skygge og deteksjon — la PVGIS eie produksjonstallet.

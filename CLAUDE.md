# pvmap — CLAUDE.md

## Prosjektbeskrivelse

Solkart-applikasjon som lar brukere søke opp en adresse, se takflater på eiendommen fargekodet etter solinnstråling, velge paneler, og sende forespørsel om uforpliktende tilbud. Embeddes som `<iframe>` i et eksternt dashboard via postMessage-integrasjon.

## Pågående arbeid: Erstatning av Norkart

Norkart fjernes og erstattes med en egenlaget løsning. **Payload-formatet som flyter gjennom resten av appen skal forbli identisk** — kun API-rutene og MapComponent endres.

---

## Norkart brukes tre steder

### 1. `/api/search/route.js` — Adressesøk

Kaller `fritekstsok.api.norkart.no` med brukerens søkestreng.

**Output-shape som `Searchbar.js` forventer (må bevares):**
```js
data.Options.map((option) => ({
  text: option.Text,
  id: option.PayLoad.AdresseMatrikkelNummer,  // brukes som addressId i URL
  latlng: {
    lat: option.PayLoad.Posisjon.Y,
    lng: option.PayLoad.Posisjon.X,
  },
}))
```

**Planlagt erstatning:** Kartverkets gratis geocoding-API
```
GET https://ws.geonorge.no/adresser/v1/sok?sok=QUERY&fuzzy=true&treffPerSide=10
```
Mapper `adressetekst`, `representasjonspunkt.lat/lon` og `adressekode` til samme shape i route-handleren. Resten av appen rører vi ikke.

---

### 2. `/api/roof/route.js` — Takflate-data

Kaller `takflater.api.norkart.no/takflater/matrikkel/:addressId`.

**Output-shape som `map/page.js` forventer (må bevares):**
```js
roofData.map((roof) => ({
  area:        roof.Areal3D,    // takflatens areal i m²
  coordinates: roof.Geometri,  // GeoJSON-polygon (stringified)
  direction:   roof.Retning,   // 0–360°, himmelretning
  angle:       roof.Helning,   // takvinkkel i grader
  // roof.Lengde og roof.Bredde brukes til panelberegning i map/page.js:128-129
}))
```

`Helning` og `Retning` beregnes av Norkart fra lidar-data. Mulige alternativer:
- **Alternativ A:** Kartverket FKB-Bygning/Tak via WFS — gir takflate-polygoner med kotehøyder, vi beregner helning/retning selv fra geometrien
- **Alternativ B:** Kartverkets gratis lidar-høydedata (`hoydedata.no`) + planet-fitting per takflate

---

### 3. `MapComponent.js` — Kartfliser (Webatlas)

Bruker `leaflet-webatlastile` med `NORKART_API_KEY` for flyfoto og grå kartvisning. Nøkkelen eksponeres til frontend via `/api/apiKey`.

**Planlagt erstatning:**
```js
// Kartverkets gratis flyfoto WMS:
L.tileLayer.wms("https://wms.geonorge.no/skwms1/wms.nib", {
  layers: "ortofoto", format: "image/jpeg", transparent: false
})
// eller Mapbox satellite tiles
```
`/api/apiKey/route.js` kan fjernes helt når dette er gjort.

---

## Hva som endres vs. hva som ikke røres

| Fil | Status |
|---|---|
| `src/app/api/search/route.js` | Byttes ut — ny URL, behold output-shape |
| `src/app/api/roof/route.js` | Byttes ut — ny kilde, beregn Helning/Retning selv |
| `src/components/MapComponent.js` | Bytt `webatlasTileLayer` → `L.tileLayer`/WMS |
| `src/app/api/apiKey/route.js` | Fjernes |
| `src/app/map/page.js` | Rører ikke |
| `src/components/Searchbar.js` | Rører ikke |
| `src/components/RoofList.js` | Rører ikke |
| PVGIS-kall og beregningslogikk | Rører ikke |

---

## postMessage-integrasjon (dashboard-handoff)

pvmap embeddes som `<iframe>` i et eksternt dashboard.

**Dashboard sender til pvmap (query params):**
```
https://pvmap.vercel.app/?site=solarinstallationdashboard&preAdr=<address>
```

**pvmap sender tilbake (postMessage med `type === "PVMAP_DATA"`):**
```js
{
  totalPanels, selectedPanelType, checkedRoofData,
  selectedElPrice, yearlyCost, yearlyCost2, yearlyProd,
  desiredKwh, coveragePercentage, imageUrl, voltage
}
```

`selectedRoofType` sendes ikke — taktype hentes fra `roofTypeId` på leaden i dashboardet.

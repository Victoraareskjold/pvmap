"use client";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  webatlasTileLayer,
  WebatlasTileLayerTypes,
} from "leaflet-webatlastile";

const MapComponent = ({
  lat,
  lng,
  combinedData,
  isChecked,
  toggleRoof,
  adjustedPanelCounts,
  apiKey,
}) => {
  useEffect(() => {
    let map;
    let currentLayer;

    if (lat && lng && apiKey) {
      if (L.DomUtil.get("map")?._leaflet_id) {
        L.DomUtil.get("map")._leaflet_id = null;
      }
      map = L.map("map").setView([lat, lng], 25);

      // Opprett AERIAL og HYBRID kartlag
      const aerialLayer = webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.AERIAL,
      });

      const greyLayer = webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.GREY,
      });

      currentLayer = aerialLayer;
      currentLayer.addTo(map);

      // Lag en tilpasset kontroll
      const LayerToggleControl = L.Control.extend({
        onAdd: function () {
          const button = L.DomUtil.create("img", "layer-toggle-button");
          button.src = "/layers.png";
          button.alt = "Endre karttype";
          button.style.cursor = "pointer";
          button.style.backgroundColor = "white";
          button.style.border = "1px solid black";
          button.style.borderRadius = "4px";
          button.style.width = "32px";
          button.style.height = "32px";

          button.onclick = () => {
            // Fjern nåværende lag
            map.removeLayer(currentLayer);

            // Bytt lag
            if (currentLayer === aerialLayer) {
              currentLayer = greyLayer;
            } else {
              currentLayer = aerialLayer;
            }

            // Legg til det nye laget
            currentLayer.addTo(map);
          };

          return button;
        },
      });

      // Legg til kontrollen i kartet
      map.addControl(new LayerToggleControl({ position: "topright" }));

      if (combinedData.length > 0) {
        combinedData.forEach((roof) => {
          /* if (roof.panels.panelCount <= minPanels) {
            return;
          } */
          try {
            const coordinates = JSON.parse(roof.coordinates);

            if (
              coordinates &&
              coordinates.coordinates &&
              coordinates.coordinates[0]
            ) {
              const cleanedCoordinates = coordinates.coordinates[0].map(
                ([lng, lat]) => [lat, lng]
              );

              function getColorCategory(azimuth, tilt) {
                if (Math.abs(azimuth) <= 10 && tilt >= 20 && tilt <= 60) {
                  return "#FF1F1F"; // Svært god
                } else if (
                  Math.abs(azimuth) <= 30 &&
                  tilt >= 20 &&
                  tilt <= 60
                ) {
                  return "#FC6A20"; // God
                } else if (Math.abs(azimuth) <= 90 && tilt >= 0 && tilt <= 60) {
                  return "#FFF53C"; // Middels
                } else if (
                  Math.abs(azimuth) <= 120 &&
                  tilt >= 10 &&
                  tilt <= 80
                ) {
                  return "#BAE242"; // Under middels
                } else {
                  return "#5178DB"; // Dårlig
                }
              }

              /* Min løsning */
              /* let color;
              let yearlyOutput = roof.pv?.outputs.totals.fixed.E_y / roof.area;

              if (yearlyOutput < 125) {
                color = "red";
              } else if (yearlyOutput < 275) {
                color = "orange";
              } else color = "green"; */

              /* const polygon = L.polygon(cleanedCoordinates, {
                color: "black",
                fillColor: isChecked[roof.id] ? color : "grey",
                fillOpacity: isChecked[roof.id] ? 1 : 0.5,
                weight: 1,
              }).addTo(map); */

              const polygon = L.polygon(cleanedCoordinates, {
                color: "black",
                fillColor: getColorCategory(roof.direction - 180, roof.angle),

                fillOpacity: 1,
                weight: isChecked[roof.id] ? 4 : 1,
              }).addTo(map);

              polygon.on("click", () => {
                if (roof.panels.panelCount < 6) {
                  const infoPopup = L.popup()
                    .setLatLng(polygon.getBounds().getCenter())
                    .setContent("<p>Denne takflaten er for liten.</p>")
                    .openOn(map);
                  return;
                }

                toggleRoof(roof.id, !isChecked[roof.id]);
              });
            } else {
              console.warn(
                "Koordinater er ikke tilgjengelige for takflate:",
                roof.id
              );
            }
          } catch (error) {
            console.error("Feil ved parsing av koordinater:", error);
          }
        });
      }
    }

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, combinedData, isChecked, apiKey, adjustedPanelCounts]);

  const getColorCategory = (azimuth, tilt) => {
    if (Math.abs(azimuth) <= 10 && tilt >= 20 && tilt <= 60) {
      return "#FF1F1F"; // Svært god
    } else if (Math.abs(azimuth) <= 30 && tilt >= 20 && tilt <= 60) {
      return "#FC6A20"; // God
    } else if (Math.abs(azimuth) <= 90 && tilt >= 0 && tilt <= 60) {
      return "#FFF53C"; // Middels
    } else if (Math.abs(azimuth) <= 120 && tilt >= 10 && tilt <= 80) {
      return "#BAE242"; // Under middels
    } else {
      return "#5178DB"; // Dårlig
    }
  };

  return <div id="map" className="map z-10 w-full h-full"></div>;
};

export default MapComponent;

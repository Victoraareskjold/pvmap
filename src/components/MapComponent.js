import L from "leaflet";
import {
  webatlasTileLayer,
  WebatlasTileLayerTypes,
} from "leaflet-webatlastile";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

const MapComponent = ({
  lat,
  lng,
  combinedData,
  isChecked,
  toggleRoof,
  apiKey,
}) => {
  const mapRef = useRef(null);
  const polygonsRef = useRef([]);

  // Initialiser kartet én gang
  useEffect(() => {
    if (lat && lng && apiKey && !mapRef.current) {
      mapRef.current = L.map("map").setView([lat, lng], 25);

      const aerialLayer = webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.AERIAL,
      });

      const greyLayer = webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.GREY,
      });

      aerialLayer.addTo(mapRef.current);

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
            if (mapRef.current.hasLayer(aerialLayer)) {
              mapRef.current.removeLayer(aerialLayer);
              greyLayer.addTo(mapRef.current);
            } else {
              mapRef.current.removeLayer(greyLayer);
              aerialLayer.addTo(mapRef.current);
            }
          };

          return button;
        },
      });

      mapRef.current.addControl(
        new LayerToggleControl({ position: "topright" })
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, apiKey]);

  // Oppdater polygonene uten å initiere kartet på nytt
  useEffect(() => {
    if (!mapRef.current) return;

    // Fjern eksisterende polygoner
    polygonsRef.current.forEach((polygon) => {
      mapRef.current.removeLayer(polygon);
    });
    polygonsRef.current = [];

    // Legg til nye polygoner
    if (combinedData.length > 0) {
      combinedData.forEach((roof) => {
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

            const polygon = L.polygon(cleanedCoordinates, {
              color: "black",
              fillColor: getColorCategory(roof.direction - 180, roof.angle),
              fillOpacity: isChecked[roof.id] ? 1 : 0.65,
              weight: isChecked[roof.id] ? 4 : 1,
            }).addTo(mapRef.current);

            polygon.on("click", () => {
              if (roof.panels.panelCount < 6) {
                const infoPopup = L.popup()
                  .setLatLng(polygon.getBounds().getCenter())
                  .setContent("<p>Denne takflaten er for liten.</p>")
                  .openOn(mapRef.current);
                return;
              }

              toggleRoof(roof.id, !isChecked[roof.id]);
            });

            polygonsRef.current.push(polygon);
          }
        } catch (error) {
          console.error("Feil ved parsing av koordinater:", error);
        }
      });
    }
  }, [combinedData, isChecked]);

  function getColorCategory(azimuth, tilt) {
    if (Math.abs(azimuth) <= 20 && tilt >= 15 && tilt <= 50) {
      return "#FF0000"; // Svært god
    }
    if (Math.abs(azimuth) <= 60 && tilt >= 10 && tilt <= 60) {
      return "#FF8800"; // God
    }
    if ((tilt >= 0 && tilt <= 8) || Math.abs(azimuth) <= 110) {
      return "#FFF600"; // Middels
    }
    if (Math.abs(azimuth) <= 120 && tilt > 8 && tilt <= 90) {
      return "#D4FF00"; // Under middels
    }

    return "#00BBFF"; // Dårlig
  }

  return <div id="map" className="map z-10 w-full h-2/5 lg:h-full"></div>;
};

export default MapComponent;

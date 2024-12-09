import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  webatlasTileLayer,
  WebatlasTileLayerTypes,
} from "leaflet-webatlastile";

const Map = ({
  lat,
  lng,
  combinedData,
  isChecked,
  apiKey,
  minPanels,
  toggleRoof,
}) => {
  useEffect(() => {
    let map;

    if (lat && lng && apiKey) {
      map = L.map("map").setView([lat, lng], 25);

      webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.AERIAL,
      }).addTo(map);

      if (combinedData.length > 0) {
        combinedData.forEach((roof) => {
          if (roof.panels.panelCount <= minPanels) return;

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

              let color;
              let yearlyOutput = roof.pv?.outputs.totals.fixed.E_y / roof.area;

              if (yearlyOutput < 125) {
                color = "red";
              } else if (yearlyOutput < 275) {
                color = "orange";
              } else color = "green";

              const polygon = L.polygon(cleanedCoordinates, {
                color: "black",
                fillColor: color,
                fillOpacity: 1,
                weight: isChecked[roof.id] ? 4 : 1,
              }).addTo(map);

              polygon.on("click", () => {
                toggleRoof(roof.id, !isChecked[roof.id]);
              });
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
  }, [lat, lng, combinedData, isChecked, apiKey]);

  return <div id="map" className="map hidden md:block"></div>;
};

export default Map;

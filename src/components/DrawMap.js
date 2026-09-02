"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { useEffect, useRef } from "react";
import { isRoofEligible } from "@/lib/roofs";

/**
 * Leaflet map where the user outlines the roof planes themselves.
 *
 * This is the fallback path: it runs when Google has no roof analysis for
 * the address, when the Solar quota is spent, or when the user asks to draw
 * instead. The polygon gives us area plus a bounding length and width; the
 * user sets pitch and direction afterwards in the roof list.
 */
export default function DrawMap({
  center,
  roofs,
  checked,
  onToggle,
  onRoofAdded,
  onDrawStart,
}) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({}); // roof id → leaflet layer

  const onRoofAddedRef = useRef(onRoofAdded);
  const onToggleRef = useRef(onToggle);
  const onDrawStartRef = useRef(onDrawStart);
  const checkedRef = useRef(checked);
  // Klikkhåndtereren festes én gang per lag, så den må slå opp flaten på nytt
  // for å se dagens kapasitet — helningen kan ha endret seg siden.
  const roofsRef = useRef(roofs);
  useEffect(() => {
    onRoofAddedRef.current = onRoofAdded;
    onToggleRef.current = onToggle;
    onDrawStartRef.current = onDrawStart;
    checkedRef.current = checked;
    roofsRef.current = roofs;
  }, [onRoofAdded, onToggle, onDrawStart, checked, roofs]);

  useEffect(() => {
    if (!center || !divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, { maxZoom: 22, zoomControl: true }).setView(
      [center.lat, center.lng],
      20
    );
    mapRef.current = map;

    // Begge lagene kommer fra Mapbox. CARTOs gratis basemap-CDN krever nøkkel
    // nå og svarer "API key required", så kartvisningen bruker samme token
    // som flyfotoet.
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const mapboxLayer = (style) =>
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${token}`,
        {
          attribution: "© Mapbox © OpenStreetMap",
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 22,
        }
      );
    const aerial = mapboxLayer("satellite-v9");
    const plain = mapboxLayer("light-v11");
    aerial.addTo(map);

    const BaseToggle = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create("button", "");
        btn.type = "button";
        btn.textContent = "Kartvisning";
        Object.assign(btn.style, {
          background: "#fff",
          border: "1px solid #ece2d8",
          borderRadius: "999px",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          cursor: "pointer",
          font: "600 12px/1 inherit",
          padding: "8px 12px",
        });
        L.DomEvent.disableClickPropagation(btn);
        let isAerial = true;
        btn.onclick = () => {
          if (isAerial) {
            map.removeLayer(aerial);
            plain.addTo(map);
          } else {
            map.removeLayer(plain);
            aerial.addTo(map);
          }
          isAerial = !isAerial;
        };
        return btn;
      },
    });
    map.addControl(new BaseToggle({ position: "topright" }));

    map.addControl(
      new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: "#b56c00",
              fillColor: "#ff9d00",
              fillOpacity: 0.5,
            },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: false,
      })
    );

    map.on(L.Draw.Event.DRAWSTART, () => onDrawStartRef.current?.());

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      const ring = layer.getLatLngs()[0];
      const bounds = layer.getBounds();
      const ne = bounds.getNorthEast();

      onRoofAddedRef.current({
        coordinates: JSON.stringify(layer.toGeoJSON().geometry),
        area: L.GeometryUtil.geodesicArea(ring),
        length: ne.distanceTo(bounds.getNorthWest()),
        width: ne.distanceTo(bounds.getSouthEast()),
        layer,
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [center]);

  // Attach, style and prune the drawn layers as the roof list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const known = new Set(roofs.map((r) => r.id));
    for (const id of Object.keys(layersRef.current)) {
      if (!known.has(id)) {
        map.removeLayer(layersRef.current[id]);
        delete layersRef.current[id];
      }
    }

    for (const roof of roofs) {
      let layer = layersRef.current[roof.id];
      if (!layer && roof._layer) {
        layer = roof._layer;
        layersRef.current[roof.id] = layer;
        layer.addTo(map);
        layer.on("click", () => {
          const current = roofsRef.current.find((r) => r.id === roof.id);
          if (current && !isRoofEligible(current)) return;
          onToggleRef.current(roof.id);
        });
      }
      if (!layer) continue;

      // For liten flate: stiplet omriss uten fyll, samme signal som krysset i
      // listen. Den kan verken klikkes på eller telle med.
      const eligible = isRoofEligible(roof);
      const on = eligible && !!checked[roof.id];
      layer.setStyle({
        color: eligible ? (on ? "#1b1815" : "#ffffff") : "#8a8378",
        weight: on ? 3 : 1.5,
        dashArray: eligible ? null : "4 4",
        fillColor: roof.rating.color,
        fillOpacity: eligible ? (on ? 0.75 : 0.3) : 0.08,
      });
    }
  }, [roofs, checked]);

  return <div ref={divRef} className="map-surface" />;
}

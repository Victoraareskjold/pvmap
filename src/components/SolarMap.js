"use client";

import { useEffect, useRef, useState } from "react";
import { panelCorners } from "@/lib/solar";
import { loadRgbOverlay } from "@/lib/geotiffOverlay";

/**
 * Google Maps with the Solar API panels drawn on top.
 *
 * The Solar API terms require solar data to be shown on a Google map with
 * the attribution "Source: Includes solar data from Google" visible.
 *
 * Sizing comes from the parent: this renders into `.map-surface`, which is
 * absolutely positioned inside the page's sized `.map-box`.
 */

let mapsLoader = null;

function loadGoogleMaps(key) {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const cb = "__pvmapMapsInit";
    window[cb] = () => {
      delete window[cb];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&v=weekly&loading=async&callback=${cb}`;
    script.async = true;
    script.onerror = () => {
      mapsLoader = null;
      reject(
        new Error(
          "Kartet ble blokkert av nettleseren. Slå av annonseblokkeren for denne siden og last inn på nytt."
        )
      );
    };
    document.head.appendChild(script);
  });

  return mapsLoader;
}

export default function SolarMap({
  center,
  building,
  roofs,
  checked,
  panelCounts,
  onToggle,
}) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const shapesRef = useRef([]);
  const overlayRef = useRef(null);
  const onToggleRef = useRef(onToggle);
  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [showAerial, setShowAerial] = useState(false);
  const [aerialStatus, setAerialStatus] = useState(null);

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const solarPotential = building?.solarPotential;

  // Google reports key problems through this global, not a rejected promise.
  useEffect(() => {
    window.gm_authFailure = () =>
      setError("Google avviste kartnøkkelen. Kartet kan ikke vises akkurat nå.");
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (!center || !mapsKey) return;
    let cancelled = false;

    loadGoogleMaps(mapsKey)
      .then((maps) => {
        if (cancelled || !divRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(divRef.current, {
            center: { lat: center.lat, lng: center.lng },
            zoom: 20,
            mapTypeId: "satellite",
            tilt: 0,
            disableDefaultUI: true,
            zoomControl: true,
          });
        } else {
          mapRef.current.setCenter({ lat: center.lat, lng: center.lng });
          mapRef.current.setZoom(20);
        }
        setReady(true);
      })
      .catch((e) => setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [center, mapsKey]);

  // Redraw the panels whenever the selection changes
  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapRef.current || !maps || !solarPotential) return;

    shapesRef.current.forEach((s) => s.setMap(null));
    shapesRef.current = [];

    const bounds = new maps.LatLngBounds();

    for (const roof of roofs) {
      const on = !!checked[roof.id];
      const count = panelCounts[roof.id] ?? roof.maxPanels;

      roof.panels.forEach((panel, i) => {
        const active = on && i < count;
        const corners = panelCorners(panel, solarPotential);
        corners.forEach((c) => bounds.extend(c));

        // Deselected panels are drawn as thin outlines with no fill. With
        // fill the map turns into a mess of translucent squares stacked on
        // top of each other.
        const shape = new maps.Polygon({
          paths: corners,
          strokeColor: active ? "#0b1220" : "#ffffff",
          strokeOpacity: active ? 1 : 0.35,
          strokeWeight: active ? 0.6 : 0.5,
          fillColor: roof.rating.color,
          fillOpacity: active ? 0.92 : 0,
          map: mapRef.current,
          zIndex: active ? 2 : 1,
        });
        shape.addListener("click", () => onToggleRef.current(roof.id));
        shapesRef.current.push(shape);
      });
    }

    if (!bounds.isEmpty() && !mapRef.current.__fitted) {
      mapRef.current.fitBounds(bounds, 40);
      mapRef.current.__fitted = true;
    }
  }, [roofs, checked, panelCounts, solarPotential]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.__fitted = false;
  }, [solarPotential]);

  /*
    Google's own aerial photo of the building, from the same capture as the
    roof analysis. The satellite tiles underneath are a different capture
    from a different angle, so this layer is the only one where the panels
    can be judged against the right image. Fetched on demand only — Data
    Layers is the expensive SKU.
  */
  useEffect(() => {
    if (!showAerial || !center || !ready) return;
    let cancelled = false;

    setAerialStatus("henter…");
    loadRgbOverlay(`/api/solar/rgb?lat=${center.lat}&lng=${center.lng}`)
      .then(({ canvas, bounds }) => {
        if (cancelled || !mapRef.current) return;
        overlayRef.current?.setMap(null);
        overlayRef.current = new window.google.maps.GroundOverlay(
          canvas.toDataURL("image/png"),
          bounds,
          { clickable: false, opacity: 1 }
        );
        overlayRef.current.setMap(mapRef.current);
        setAerialStatus(null);
      })
      .catch((e) => {
        if (!cancelled) setAerialStatus(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [showAerial, center, ready]);

  useEffect(() => {
    if (!showAerial) {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      setAerialStatus(null);
    }
  }, [showAerial]);

  if (!mapsKey || error) {
    return (
      <div className="map-surface flex items-center justify-center p-6 text-center text-sm">
        <p style={{ color: "var(--ink-soft)" }}>
          {error ?? "Kartet er ikke konfigurert (NEXT_PUBLIC_GOOGLE_MAPS_KEY mangler)."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={divRef} className="map-surface" />

      <button
        onClick={() => setShowAerial((v) => !v)}
        className="btn btn-secondary absolute right-3 top-3 z-20 !px-3 !py-1.5 !text-xs"
      >
        {showAerial ? "Skjul Googles flyfoto" : "Vis Googles flyfoto"}
        {aerialStatus && (
          <span className="font-normal" style={{ color: "var(--accent-dark)" }}>
            {aerialStatus}
          </span>
        )}
      </button>

      <div className="pointer-events-none absolute bottom-1 left-1 z-20 rounded bg-black/55 px-2 py-0.5 text-[10px] text-white">
        Source: Includes solar data from Google
      </div>
    </>
  );
}

/**
 * Decodes Google's RGB GeoTIFF and turns it into an image layer for the map.
 *
 * The GeoTIFF arrives in a projected UTM zone, not in latitude/longitude, so
 * the corner coordinates must be reprojected to WGS84 before Google Maps
 * understands them. That is what proj4 is here for.
 */

import proj4 from "proj4";
import { fromArrayBuffer } from "geotiff";

/** Reads the EPSG code out of the GeoTIFF's geo keys. */
function readEpsg(image) {
  const keys = image.getGeoKeys?.() ?? {};
  return keys.ProjectedCSTypeGeoKey ?? keys.GeographicTypeGeoKey ?? 4326;
}

/**
 * Loads the image and returns a canvas plus its corners in WGS84.
 * @returns {Promise<{canvas: HTMLCanvasElement, bounds: {north:number,south:number,east:number,west:number}}>}
 */
export async function loadRgbOverlay(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Bildet kunne ikke hentes (${res.status})`);
  }

  const tiff = await fromArrayBuffer(await res.arrayBuffer());
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();

  // Paint the RGB bands into a canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(width, height);

  const [r, g, b] = rasters;
  for (let i = 0; i < width * height; i++) {
    pixels.data[i * 4] = r[i];
    pixels.data[i * 4 + 1] = g?.[i] ?? r[i];
    pixels.data[i * 4 + 2] = b?.[i] ?? r[i];
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);

  // Reproject the corners to lat/lng
  const epsg = readEpsg(image);
  const [minX, minY, maxX, maxY] = image.getBoundingBox();

  let southWest, northEast;
  if (Number(epsg) === 4326) {
    southWest = [minX, minY];
    northEast = [maxX, maxY];
  } else {
    const from = `EPSG:${epsg}`;
    if (!proj4.defs(from)) {
      // Northern UTM zones: EPSG 326xx → zone = xx
      const zone = Number(epsg) - 32600;
      if (zone > 0 && zone <= 60) {
        proj4.defs(from, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
      } else {
        throw new Error(`Ukjent projeksjon i bildet: EPSG:${epsg}`);
      }
    }
    southWest = proj4(from, "EPSG:4326", [minX, minY]);
    northEast = proj4(from, "EPSG:4326", [maxX, maxY]);
  }

  return {
    canvas,
    bounds: {
      west: southWest[0],
      south: southWest[1],
      east: northEast[0],
      north: northEast[1],
    },
  };
}

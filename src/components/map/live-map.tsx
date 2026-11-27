"use client";
// Interactive map (MapLibre GL JS + OpenFreeMap vector tiles, user decision 2026-11-27, replaces the drawn map of
// decision F2): zoom, pan, full screen, scale, popups. Park areas, the search radius and pathways are map layers;
// sites are focusable HTML markers with a popup. Everything shown comes from the server props – the page keeps a
// list with the same information, so the map is never the only way to reach a site (and it may fail to load).
//
// Texts inside popups come from the database (company and site names): they are always set as textContent, never
// as HTML.
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PlatformMessages } from "@/i18n/platform";
import { arc, boundsOf, circleRing, sameSpotOffsets, type GeoPoint, type Position } from "./geo";
import { markerClass, type MarkerKind } from "./marker-style";

/** Light, quiet vector style without a key or an account. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const BRAND = "#22392e";
const INK = "#1d3127";
const FONT_BOLD = ["Noto Sans Bold"];

export type LiveMapLink = { href: string; label: string };
export type LiveMapPark = GeoPoint & { id: number; name: string; city: string; radiusM: number; lines?: string[]; links?: LiveMapLink[] };
export type LiveMapMarker = GeoPoint & {
  id: number;
  /** Short text in the marker (a number matching the list). */
  label: string;
  kind: MarkerKind;
  title: string;
  lines: string[];
  links: LiveMapLink[];
  /** Open its popup and move the map to it. */
  selected?: boolean;
  /** Part of a highlighted collection group. */
  highlighted?: boolean;
};
export type LiveMapPathway = { code: string; from: GeoPoint; to: GeoPoint | null; title: string; lines: string[] };

type Props = {
  parks: LiveMapPark[];
  markers?: LiveMapMarker[];
  pathways?: LiveMapPathway[];
  /** Centre and radius of a wider search (straight line). */
  radius?: (GeoPoint & { km: number }) | null;
  label: string;
  t: PlatformMessages["map"];
  /** Height and corners of the map frame. */
  className?: string;
  /** Content placed on the map (e.g. a badge on the start page). */
  overlay?: ReactNode;
};

type Navigate = (href: string) => void;

/** Popup body built from DOM nodes: names from the database never become HTML. */
function popupContent(title: string, lines: string[], links: LiveMapLink[], navigate: Navigate): HTMLElement {
  const root = document.createElement("div");
  root.className = "grid gap-1 pr-7 text-[15px] leading-snug text-ink";
  const heading = document.createElement("p");
  heading.className = "font-semibold text-pretty";
  heading.textContent = title;
  root.append(heading);
  for (const line of lines) {
    const paragraph = document.createElement("p");
    paragraph.className = "text-[13px] leading-normal text-muted";
    paragraph.textContent = line;
    root.append(paragraph);
  }
  if (links.length > 0) {
    const list = document.createElement("p");
    list.className = "mt-1 flex flex-wrap gap-x-4 gap-y-1";
    for (const link of links) {
      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.label;
      anchor.className = "font-medium underline decoration-1 underline-offset-2 hover:decoration-2";
      anchor.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // new tab stays a normal link
        event.preventDefault();
        navigate(link.href);
      });
      list.append(anchor);
    }
    root.append(list);
  }
  return root;
}

const featureCollection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const polygon = (ring: Position[], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [ring] } });
const lineString = (line: Position[], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates: line } });
const pointFeature = (point: GeoPoint, properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [point.longitude, point.latitude] } });

/** Our sources and layers, added once after the style has loaded; later only their data changes. */
function addLayers(map: MapLibreMap) {
  const empty = featureCollection([]);
  for (const id of ["kw-parks", "kw-park-labels", "kw-radius", "kw-pathways"]) map.addSource(id, { type: "geojson", data: empty });
  map.addLayer({ id: "kw-parks-fill", type: "fill", source: "kw-parks", paint: { "fill-color": BRAND, "fill-opacity": 0.14 } });
  map.addLayer({ id: "kw-parks-line", type: "line", source: "kw-parks", paint: { "line-color": BRAND, "line-width": 2, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "kw-radius-line", type: "line", source: "kw-radius", paint: { "line-color": INK, "line-width": 1.5, "line-opacity": 0.7, "line-dasharray": [3, 3] } });
  map.addLayer({ id: "kw-pathways-line", type: "line", source: "kw-pathways", layout: { "line-cap": "round" }, paint: { "line-color": INK, "line-width": 2, "line-dasharray": [3, 2] } });
  map.addLayer({
    id: "kw-pathways-arrow",
    type: "symbol",
    source: "kw-pathways",
    layout: { "symbol-placement": "line", "symbol-spacing": 90, "text-field": "›", "text-font": FONT_BOLD, "text-size": 22, "text-keep-upright": false, "text-allow-overlap": true },
    paint: { "text-color": INK, "text-halo-color": "#fff", "text-halo-width": 1.5 },
  });
  map.addLayer({
    id: "kw-park-names",
    type: "symbol",
    source: "kw-park-labels",
    layout: { "text-field": ["get", "name"], "text-font": FONT_BOLD, "text-size": 13, "text-max-width": 12, "text-anchor": "bottom", "text-offset": [0, -0.3] },
    paint: { "text-color": INK, "text-halo-color": "#fff", "text-halo-width": 2 },
  });
}

export function LiveMap({ parks, markers = [], pathways = [], radius = null, label, t, className = "h-[420px] md:h-[520px]", overlay }: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const drawn = useRef<Marker[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  // The view to fit: parks with their areas and all markers. Fitted again only when this set changes.
  const viewKey = JSON.stringify(boundsOf([...parks, ...markers]));

  // 1. Create the map once; MapLibre needs the browser (WebGL), so it is loaded only here.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let timeout: number | undefined;
    import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !container.current) return;
        const bounds = JSON.parse(viewKey) as [Position, Position] | null;
        try {
          map = new lib.Map({
            container: container.current,
            style: MAP_STYLE,
            ...(bounds ? { bounds, fitBoundsOptions: { padding: 48, maxZoom: 14 } } : { center: [6.58, 51.48], zoom: 10 }),
            minZoom: 6,
            maxZoom: 18,
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            maxPitch: 0,
            attributionControl: { compact: true },
            locale: {
              "NavigationControl.ZoomIn": t.ui.zoomIn,
              "NavigationControl.ZoomOut": t.ui.zoomOut,
              "FullscreenControl.Enter": t.ui.fullscreen,
              "FullscreenControl.Exit": t.ui.fullscreenExit,
              "Popup.Close": t.ui.close,
              "AttributionControl.ToggleAttribution": t.ui.attribution,
              "CooperativeGesturesHandler.WindowsHelpText": t.ui.gestureWindows,
              "CooperativeGesturesHandler.MacHelpText": t.ui.gestureMac,
              "CooperativeGesturesHandler.MobileHelpText": t.ui.gestureMobile,
              "ScaleControl.Meters": t.ui.metres,
              "ScaleControl.Kilometers": t.ui.kilometres,
              "Map.Title": label,
            },
          });
        } catch {
          setState("failed"); // no WebGL
          return;
        }
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new lib.FullscreenControl(), "top-right");
        map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
        // A single tile or font that fails before the first load leaves the map usable; only a map that has not
        // loaded after 15 s (style or tile server unreachable) shows the notice.
        timeout = window.setTimeout(() => {
          if (!cancelled) setState("failed");
        }, 15_000);
        map.on("load", () => {
          window.clearTimeout(timeout);
          if (cancelled || !map) return;
          addLayers(map);
          libRef.current = lib;
          mapRef.current = map;
          setState("ready");
        });
      })
      .catch(() => setState("failed"));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      drawn.current.forEach((marker) => marker.remove());
      drawn.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; data changes are drawn by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Fit the view when the set of places changes (another search), not on every selection.
  useEffect(() => {
    const map = mapRef.current;
    const bounds = JSON.parse(viewKey) as [Position, Position] | null;
    if (state !== "ready" || !map || !bounds) return;
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
  }, [state, viewKey]);

  // 3. Draw parks, radius, pathways and markers.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (state !== "ready" || !map || !lib) return;
    const navigate: Navigate = (href) => router.push(href);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (map.getSource("kw-parks") as GeoJSONSource).setData(featureCollection(parks.map((park) => polygon(circleRing(park, park.radiusM), { id: park.id }))));
    // Names sit on the north edge of the area, so markers inside the park never cover them.
    (map.getSource("kw-park-labels") as GeoJSONSource).setData(featureCollection(parks.map((park) => pointFeature({ longitude: park.longitude, latitude: circleRing(park, park.radiusM, 4)[0][1] }, { name: park.name }))));
    (map.getSource("kw-radius") as GeoJSONSource).setData(featureCollection(radius ? [polygon(circleRing(radius, radius.km * 1000, 96))] : []));
    const lines = pathways.flatMap((pathway, index) => (pathway.to ? [{ pathway, ...arc(pathway.from, pathway.to, 0.18 + index * 0.06) }] : []));
    (map.getSource("kw-pathways") as GeoJSONSource).setData(featureCollection(lines.map(({ line, pathway }) => lineString(line, { code: pathway.code }))));

    drawn.current.forEach((marker) => marker.remove());
    const created: Marker[] = [];
    const popupOf = (title: string, text: string[], links: LiveMapLink[]) =>
      new lib.Popup({ offset: 20, maxWidth: "300px", focusAfterOpen: true }).setDOMContent(popupContent(title, text, links, navigate));

    // Park areas: a click on the area opens the park popup (names and links) – the list repeats them.
    const parkPopup = new lib.Popup({ offset: 4, maxWidth: "300px" });
    const onParkClick = (event: { lngLat: { lng: number; lat: number }; features?: { properties: Record<string, unknown> }[] }) => {
      const park = parks.find((entry) => entry.id === Number(event.features?.[0]?.properties.id));
      if (!park) return;
      parkPopup.setLngLat(event.lngLat).setDOMContent(popupContent(park.name, [park.city, ...(park.lines ?? [])], park.links ?? [], navigate)).addTo(map);
    };
    map.on("click", "kw-parks-fill", onParkClick);
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const noPointer = () => (map.getCanvas().style.cursor = "");
    map.on("mouseenter", "kw-parks-fill", pointer);
    map.on("mouseleave", "kw-parks-fill", noPointer);

    // Pathways: the case letter at the middle of the curve, or below the park without a receiver.
    const hanging = new Map<string, number>();
    pathways.forEach((pathway, index) => {
      const middle = pathway.to ? arc(pathway.from, pathway.to, 0.18 + index * 0.06).middle : null;
      const key = `${pathway.from.latitude},${pathway.from.longitude}`;
      const slot = middle ? 0 : (hanging.get(key) ?? 0);
      if (!middle) hanging.set(key, slot + 1);
      const element = document.createElement("button");
      element.type = "button";
      element.className = "grid size-7 cursor-pointer place-items-center rounded-full border-[1.5px] border-ink bg-white text-[13px] leading-none font-semibold text-ink shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";
      element.textContent = pathway.code;
      element.setAttribute("aria-label", `${t.pathway} ${pathway.code}: ${pathway.title}`);
      const marker = new lib.Marker({ element, offset: middle ? [0, 0] : [(slot % 2 === 0 ? -1 : 1) * Math.ceil(slot / 2) * 32, 34] })
        .setLngLat(middle ?? [pathway.from.longitude, pathway.from.latitude])
        .setPopup(popupOf(`${t.pathway} ${pathway.code}`, [pathway.title, ...pathway.lines], []))
        .addTo(map);
      created.push(marker);
    });

    // Sites: focusable buttons; sites on the same rounded position are spread on a small circle.
    const offsets = sameSpotOffsets(markers, 34);
    markers.forEach((entry, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = markerClass(entry.kind, entry.highlighted);
      element.textContent = entry.label;
      element.setAttribute("aria-label", `${entry.label}: ${entry.title}`);
      const marker = new lib.Marker({ element, offset: offsets[index] }).setLngLat([entry.longitude, entry.latitude]).setPopup(popupOf(entry.title, entry.lines, entry.links)).addTo(map);
      created.push(marker);
      if (entry.selected) {
        marker.togglePopup();
        map.easeTo({ center: [entry.longitude, entry.latitude], zoom: Math.max(map.getZoom(), 13), duration: reduceMotion ? 0 : 600 });
      }
    });
    drawn.current = created;

    return () => {
      map.off("click", "kw-parks-fill", onParkClick);
      map.off("mouseenter", "kw-parks-fill", pointer);
      map.off("mouseleave", "kw-parks-fill", noPointer);
      parkPopup.remove();
    };
  }, [state, parks, markers, pathways, radius, router, t]);

  return (
    // data-audit-ignore: markers, popups and controls are placed by MapLibre at geographic positions, not by the
    // page layout; overlapping markers on one position are spread by sameSpotOffsets (geo.test.ts).
    <div data-audit-ignore className={`relative isolate overflow-hidden rounded-2xl bg-map ${className}`}>
      <div ref={container} role="region" aria-label={label} className="size-full" />
      {state !== "ready" && (
        <p role={state === "failed" ? "alert" : "status"} className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-map-ink">
          {state === "failed" ? t.loadError : t.loading}
        </p>
      )}
      {overlay}
    </div>
  );
}

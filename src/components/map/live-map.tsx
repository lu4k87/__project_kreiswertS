"use client";
// Interactive map (MapLibre GL JS + OpenFreeMap vector tiles, user decision 2026-11-27, replaces the drawn map of
// decision F2): zoom, pan, full screen, scale, popups. Park areas, the search radius and pathways are map layers;
// sites are focusable HTML markers with a popup. Everything shown comes from the server props – the page keeps a
// list with the same information, so the map is never the only way to reach a site (and it may fail to load).
//
// Every element sits on a white casing and a shadow, so it stands out from the colourful base map (user, 2026-11-27:
// "the interactive elements are lame and do not stand out").
//
// `interactive` (the industrial map and the regional map, not the start page): a layer bar above the map, "show
// all", a hover state on park areas, park areas that fade in and pathways that draw themselves once, markers and
// pathway letters that pop in once, a single ping on a selected or highlighted marker and material dots travelling
// along the pathways. Every motion is off with prefers-reduced-motion; the travelling dots pause off screen.
//
// Texts inside popups come from the database (company and site names): they are always set as textContent, never
// as HTML.
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { PlatformMessages } from "@/i18n/platform";
import { arc, boundsOf, circleRing, pointAlong, spreadOffsets, type GeoPoint, type Position } from "./geo";
import { markerClass, type MarkerKind } from "./marker-style";
import { EyeIcon, EyeOffIcon, MapIcon } from "@/components/ui/icons";
import { buttonQuiet } from "@/components/ui/elements";

/** Colourful vector style (water, parks, roads in colour; user, 2026-11-27) without a key or an account. It stays
 * light in the dark colour scheme too (user, 2026-11-27); popups and controls take the page tokens (globals.css). */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const INK = "#1d3127";
/** Layer colours = tokens --color-map-park / -radius / -flow in globals.css (the legend uses the tokens). */
const PARK = "#16a34a";
const RADIUS = "#2563eb";
/** Darker than the orange motorways of the base map; white letters on it 5.2:1. */
const PATHWAY = "#c2410c";
const CASING = "#ffffff";
const CLEAR = "rgba(255, 255, 255, 0)";
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
  /** Layer bar, "show all" and subtle motion (see the header of this file). */
  interactive?: boolean;
};

type LayerKey = "parks" | "sites" | "flows" | "radius";
const ALL_LAYERS: Record<LayerKey, boolean> = { parks: true, sites: true, flows: true, radius: true };
/** Map layers per toggle; markers are switched by their kind. */
const LAYER_IDS: Record<LayerKey, string[]> = {
  parks: ["kw-parks-glow", "kw-parks-fill", "kw-parks-casing", "kw-parks-line", "kw-park-names"],
  sites: [],
  flows: ["kw-pathways-casing", "kw-pathways-line", "kw-pathways-arrow", "kw-flow-dots"],
  radius: ["kw-radius-casing", "kw-radius-line"],
};
/** Swatch of each toggle, the same colours as the layers. */
const SWATCH: Record<LayerKey, string> = {
  parks: "size-3 rounded-full border-2 border-map-park bg-map-park/30",
  sites: "size-3 rounded-full bg-map-offer",
  flows: "h-[3px] w-4 rounded-full bg-map-flow",
  radius: "size-3 rounded-full border-2 border-dashed border-map-radius",
};
/** Park areas fade in and pathways draw themselves once per page visit (--t-story 700 ms + a short lead). */
const REVEAL_MS = 900;
/** One trip of a material dot along a pathway. Faster than the 8 s of soft-motion's ambient rule on purpose: the
 * dots carry the direction of the flow and must read as moving (user, 2026-11-27); two dots per pathway, half a trip
 * apart, each fading in and out at the ends, so nothing jumps. */
const TRIP_MS = 5200;
/** The dots are redrawn at most ~30 times a second; enough for a smooth glide, half the work of every frame. */
const DOT_FRAME_MS = 33;

type Navigate = (href: string) => void;

/**
 * A marker = a still button (MapLibre places it with `transform`) around a visual that carries look, hover scale and
 * motion. The CSS `scale` / `translate` properties apply outside `transform`, so on the button itself they would scale
 * the marker's map position too: it jumped away under the pointer and the click missed (found 2026-11-27).
 */
function markerButton(visualClass: string, text: string, label: string): { element: HTMLButtonElement; visual: HTMLSpanElement } {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "group block cursor-pointer rounded-full outline-none";
  element.setAttribute("aria-label", label);
  const visual = document.createElement("span");
  visual.className = `relative ${visualClass}`;
  visual.textContent = text;
  element.append(visual);
  return { element, visual };
}

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
const polygon = (ring: Position[], properties: Record<string, unknown> = {}, id?: number): GeoJSON.Feature => ({ type: "Feature", id, properties, geometry: { type: "Polygon", coordinates: [ring] } });
const lineString = (line: Position[], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates: line } });
const pointFeature = (point: GeoPoint, properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [point.longitude, point.latitude] } });

const hover: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
/** A line drawn up to `progress` (0…1) of its length; needs `lineMetrics` on the source. */
const drawnTo = (color: string, progress: number): ExpressionSpecification =>
  progress >= 1 ? ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color] : ["step", ["line-progress"], color, Math.max(progress, 0.001), CLEAR];

/** Our sources and layers, added once after the style has loaded; later only their data changes. Every line lies on
 * a wider white casing, so it never blends into roads or rivers of the base map. */
function addLayers(map: MapLibreMap) {
  const empty = featureCollection([]);
  for (const id of ["kw-parks", "kw-park-labels", "kw-radius", "kw-flow-dots"]) map.addSource(id, { type: "geojson", data: empty });
  map.addSource("kw-pathways", { type: "geojson", data: empty, lineMetrics: true });
  map.addLayer({ id: "kw-parks-glow", type: "line", source: "kw-parks", paint: { "line-color": PARK, "line-width": 14, "line-blur": 10, "line-opacity": 0.45 } });
  map.addLayer({ id: "kw-parks-fill", type: "fill", source: "kw-parks", paint: { "fill-color": PARK, "fill-opacity": ["case", hover, 0.45, 0.26] } });
  map.addLayer({ id: "kw-parks-casing", type: "line", source: "kw-parks", paint: { "line-color": CASING, "line-width": ["case", hover, 7, 5.5] } });
  map.addLayer({ id: "kw-parks-line", type: "line", source: "kw-parks", paint: { "line-color": PARK, "line-width": ["case", hover, 3.5, 2.5] } });
  map.addLayer({ id: "kw-radius-casing", type: "line", source: "kw-radius", paint: { "line-color": CASING, "line-width": 5, "line-opacity": 0.85 } });
  map.addLayer({ id: "kw-radius-line", type: "line", source: "kw-radius", paint: { "line-color": RADIUS, "line-width": 2.5, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "kw-pathways-casing", type: "line", source: "kw-pathways", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-gradient": drawnTo(CASING, 1), "line-width": 9 } });
  map.addLayer({ id: "kw-pathways-line", type: "line", source: "kw-pathways", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-gradient": drawnTo(PATHWAY, 1), "line-width": 4.5 } });
  map.addLayer({
    id: "kw-pathways-arrow",
    type: "symbol",
    source: "kw-pathways",
    layout: { "symbol-placement": "line", "symbol-spacing": 80, "text-field": "›", "text-font": FONT_BOLD, "text-size": 28, "text-keep-upright": false, "text-allow-overlap": true, "text-offset": [0, -0.08] },
    paint: { "text-color": PATHWAY, "text-halo-color": CASING, "text-halo-width": 2 },
  });
  // Material on its way: white dots with a pathway-coloured ring, opacity per dot (fades at both ends).
  map.addLayer({
    id: "kw-flow-dots",
    type: "circle",
    source: "kw-flow-dots",
    paint: { "circle-radius": 5.5, "circle-color": CASING, "circle-stroke-color": PATHWAY, "circle-stroke-width": 3, "circle-opacity": ["get", "o"], "circle-stroke-opacity": ["get", "o"] },
  });
  map.addLayer({
    id: "kw-park-names",
    type: "symbol",
    source: "kw-park-labels",
    layout: { "text-field": ["get", "name"], "text-font": FONT_BOLD, "text-size": 14, "text-max-width": 12, "text-anchor": "bottom", "text-offset": [0, -0.5] },
    paint: { "text-color": INK, "text-halo-color": CASING, "text-halo-width": 2.5 },
  });
}

/** Park areas and pathways at `progress` (0…1) of their entrance: parks fade in a little ahead, pathways draw from
 * their start, arrows appear once a pathway is nearly complete. */
function paintReveal(map: MapLibreMap, at: number) {
  const progress = Math.min(Math.max(at, 0), 1);
  const fade = Math.min(1, progress * 1.6);
  map.setPaintProperty("kw-parks-glow", "line-opacity", 0.45 * fade);
  map.setPaintProperty("kw-parks-fill", "fill-opacity", ["case", hover, 0.45 * fade, 0.26 * fade]);
  map.setPaintProperty("kw-parks-casing", "line-opacity", fade);
  map.setPaintProperty("kw-parks-line", "line-opacity", fade);
  map.setPaintProperty("kw-pathways-casing", "line-gradient", drawnTo(CASING, progress));
  map.setPaintProperty("kw-pathways-line", "line-gradient", drawnTo(PATHWAY, progress));
  map.setPaintProperty("kw-pathways-arrow", "text-opacity", Math.max(0, (progress - 0.75) / 0.25));
}

/** Pathways that have a receiver, as the curves drawn on the map. */
const pathwayLines = (pathways: LiveMapPathway[]) =>
  pathways.flatMap((pathway, index) => (pathway.to ? [{ pathway, ...arc(pathway.from, pathway.to, 0.18 + index * 0.06) }] : []));

export function LiveMap({ parks, markers = [], pathways = [], radius = null, label, t, className = "h-[420px] md:h-[520px]", overlay, interactive = false }: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const drawn = useRef<{ marker: Marker; layer: LayerKey }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [layers, setLayers] = useState(ALL_LAYERS);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  /** Markers rise in once per page visit, not again after every filter change. */
  const entered = useRef(false);

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
      drawn.current.forEach(({ marker }) => marker.remove());
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

    (map.getSource("kw-parks") as GeoJSONSource).setData(featureCollection(parks.map((park) => polygon(circleRing(park, park.radiusM), { id: park.id }, park.id))));
    // Names sit on the north edge of the area, so markers inside the park never cover them.
    (map.getSource("kw-park-labels") as GeoJSONSource).setData(featureCollection(parks.map((park) => pointFeature({ longitude: park.longitude, latitude: circleRing(park, park.radiusM, 4)[0][1] }, { name: park.name }))));
    (map.getSource("kw-radius") as GeoJSONSource).setData(featureCollection(radius ? [polygon(circleRing(radius, radius.km * 1000, 96))] : []));
    const lines = pathwayLines(pathways);
    (map.getSource("kw-pathways") as GeoJSONSource).setData(featureCollection(lines.map(({ line, pathway }) => lineString(line, { code: pathway.code }))));

    drawn.current.forEach(({ marker }) => marker.remove());
    const created: { marker: Marker; layer: LayerKey }[] = [];
    const animate = interactive && !reduceMotion;
    const enter = animate && !entered.current;
    entered.current = true;
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
    // Hover lights the park area up (interactive maps only).
    let hovered: number | null = null;
    const setHover = (id: number | null) => {
      if (hovered !== null) map.setFeatureState({ source: "kw-parks", id: hovered }, { hover: false });
      hovered = id;
      if (id !== null) map.setFeatureState({ source: "kw-parks", id }, { hover: true });
    };
    const onParkMove = (event: { features?: { id?: string | number }[] }) => setHover(Number(event.features?.[0]?.id ?? NaN) || null);
    const onParkLeave = () => setHover(null);
    if (interactive) {
      map.on("mousemove", "kw-parks-fill", onParkMove);
      map.on("mouseleave", "kw-parks-fill", onParkLeave);
    }

    // Pathways: the case letter at the middle of the curve, or below the park without a receiver.
    const hanging = new Map<string, number>();
    pathways.forEach((pathway, index) => {
      const middle = pathway.to ? arc(pathway.from, pathway.to, 0.18 + index * 0.06).middle : null;
      const key = `${pathway.from.latitude},${pathway.from.longitude}`;
      const slot = middle ? 0 : (hanging.get(key) ?? 0);
      if (!middle) hanging.set(key, slot + 1);
      const { element, visual } = markerButton(
        "grid size-8 place-items-center rounded-full border-2 border-white bg-map-flow text-[14px] leading-none font-bold text-white shadow-[0_3px_8px_rgb(0_0_0/0.35)] transition-[scale] duration-150 ease-out group-hover:scale-110 motion-reduce:transition-none group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#1d3127]",
        pathway.code,
        `${t.pathway} ${pathway.code}: ${pathway.title}`,
      );
      if (enter) {
        visual.classList.add("kw-enter");
        visual.style.setProperty("--kw-delay", `${REVEAL_MS - 300 + Math.min(index, 8) * 50}ms`); // once the line is drawn
      }
      const marker = new lib.Marker({ element, offset: middle ? [0, 0] : [(slot % 2 === 0 ? -1 : 1) * Math.ceil(slot / 2) * 32, 34] })
        .setLngLat(middle ?? [pathway.from.longitude, pathway.from.latitude])
        .setPopup(popupOf(`${t.pathway} ${pathway.code}`, [pathway.title, ...pathway.lines], []))
        .addTo(map);
      created.push({ marker, layer: "flows" });
    });

    // Sites: focusable buttons; sites that would cover each other on screen are spread on a small circle (spread()).
    const sites: Marker[] = [];
    markers.forEach((entry, index) => {
      const { element, visual } = markerButton(markerClass(entry.kind, entry.highlighted), entry.label, `${entry.label}: ${entry.title}`);
      if (enter) {
        visual.classList.add("kw-enter");
        visual.style.setProperty("--kw-delay", `${Math.min(index, 8) * 50}ms`); // staggered, at most 8 steps
      }
      // One ping when a marker becomes the selected one or part of the highlighted group.
      if (animate && (entry.selected || entry.highlighted)) visual.classList.add("kw-ping");
      const marker = new lib.Marker({ element }).setLngLat([entry.longitude, entry.latitude]).setPopup(popupOf(entry.title, entry.lines, entry.links)).addTo(map);
      created.push({ marker, layer: "sites" });
      sites.push(marker);
      if (interactive) element.addEventListener("click", () => map.easeTo({ center: [entry.longitude, entry.latitude], duration: reduceMotion ? 0 : 500 }));
      if (entry.selected) {
        marker.togglePopup();
        map.easeTo({ center: [entry.longitude, entry.latitude], zoom: Math.max(map.getZoom(), 13), duration: reduceMotion ? 0 : 600 });
      }
    });
    drawn.current = created;
    applyLayers(map, drawn.current, layersRef.current);
    // Entrance of parks and pathways, once per page visit.
    let reveal = 0;
    if (enter) {
      const started = performance.now();
      const frame = (now: number) => {
        // the first frame time can lie before `started` → clamp to 0…1
        const linear = Math.min(Math.max((now - started) / REVEAL_MS, 0), 1);
        paintReveal(map, 1 - (1 - linear) ** 3); // ease-out
        if (linear < 1) reveal = requestAnimationFrame(frame);
      };
      paintReveal(map, 0);
      reveal = requestAnimationFrame(frame);
    }
    // Distances on screen change with the zoom → spread again after every zoom step (a few dozen markers).
    const spread = () => {
      const offsets = spreadOffsets(markers.map((entry): [number, number] => {
        const { x, y } = map.project([entry.longitude, entry.latitude]);
        return [x, y];
      }), 34);
      sites.forEach((marker, index) => marker.setOffset(offsets[index]));
    };
    spread();
    map.on("zoom", spread);

    return () => {
      if (reveal) {
        cancelAnimationFrame(reveal);
        paintReveal(map, 1);
      }
      map.off("zoom", spread);
      map.off("click", "kw-parks-fill", onParkClick);
      map.off("mouseenter", "kw-parks-fill", pointer);
      map.off("mouseleave", "kw-parks-fill", noPointer);
      map.off("mousemove", "kw-parks-fill", onParkMove);
      map.off("mouseleave", "kw-parks-fill", onParkLeave);
      setHover(null);
      parkPopup.remove();
    };
  }, [state, parks, markers, pathways, radius, router, t, interactive]);

  // 4. Layer toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (state === "ready" && map) applyLayers(map, drawn.current, layers);
  }, [state, layers]);

  // 5. Material dots travelling along the pathways: only on interactive maps, while the map is on screen and the tab
  // is visible, never with reduced motion (the arrows on the line still show the direction).
  const flowing = interactive && state === "ready" && layers.flows && pathways.some((pathway) => pathway.to);
  useEffect(() => {
    const map = mapRef.current;
    const frame = container.current;
    if (!flowing || !map || !frame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = pathwayLines(pathways).map(({ line }) => line);
    const source = map.getSource("kw-flow-dots") as GeoJSONSource;
    let onScreen = true;
    let last = 0;
    let request = 0;
    const observer = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    observer.observe(frame);
    const draw = (now: number) => {
      request = requestAnimationFrame(draw);
      if (!onScreen || document.hidden || now - last < DOT_FRAME_MS) return;
      last = now;
      source.setData(
        featureCollection(
          lines.flatMap((line, index) =>
            [0, 0.5].map((phase) => {
              const trip = (now / TRIP_MS + phase + index * 0.17) % 1;
              const [longitude, latitude] = pointAlong(line, trip);
              // fades in over the first and out over the last ~13 % of the trip
              return pointFeature({ longitude, latitude }, { o: Math.min(1, Math.sin(Math.PI * trip) * 2.5) });
            }),
          ),
        ),
      );
    };
    request = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      if (mapRef.current) source.setData(featureCollection([]));
    };
  }, [flowing, pathways]);

  const fitAll = () => {
    const map = mapRef.current;
    const bounds = JSON.parse(viewKey) as [Position, Position] | null;
    if (!map || !bounds) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: reduceMotion ? 0 : 800 });
  };
  const available: LayerKey[] = [
    ...(parks.length > 0 ? (["parks"] as const) : []),
    ...(markers.length > 0 ? (["sites"] as const) : []),
    ...(pathways.length > 0 ? (["flows"] as const) : []),
    ...(radius ? (["radius"] as const) : []),
  ];

  const frame = (
    // data-audit-ignore: markers, popups and controls are placed by MapLibre at geographic positions, not by the
    // page layout; markers that would cover each other are spread by spreadOffsets (geo.test.ts).
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
  if (!interactive) return frame;
  return (
    <div className="grid gap-3">
      {/* In the flow above the map (never on top of it), so it covers no marker at any width. */}
      <div role="toolbar" aria-label={t.ui.layers} className="flex flex-wrap items-center gap-2">
        {available.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={layers[key]}
            disabled={state !== "ready"}
            onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors duration-150 ease-out disabled:opacity-60 motion-reduce:transition-none ${
              layers[key] ? "border-ink/40 bg-mint" : "border-line bg-surface hover:bg-mint/60"
            }`}
          >
            <span className={`flex-none ${SWATCH[key]}`} aria-hidden="true" />
            {t.ui[key]}
            {layers[key] ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
          </button>
        ))}
        <button type="button" onClick={fitAll} disabled={state !== "ready"} className={`${buttonQuiet} ml-auto`}>
          <MapIcon size={16} />
          {t.ui.fitAll}
        </button>
      </div>
      {frame}
    </div>
  );
}

/** Shows or hides the map layers and markers of each toggle; a hidden marker closes its popup. */
function applyLayers(map: MapLibreMap, drawn: { marker: Marker; layer: LayerKey }[], layers: Record<LayerKey, boolean>) {
  for (const key of Object.keys(LAYER_IDS) as LayerKey[]) {
    for (const id of LAYER_IDS[key]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", layers[key] ? "visible" : "none");
  }
  for (const { marker, layer } of drawn) {
    marker.getElement().style.display = layers[layer] ? "" : "none";
    if (!layers[layer] && marker.getPopup()?.isOpen()) marker.togglePopup();
  }
}

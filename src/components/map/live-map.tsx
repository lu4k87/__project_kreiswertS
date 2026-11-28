"use client";
// Interactive map (MapLibre GL JS + OpenFreeMap vector tiles, user decision 2026-11-27, replaces the drawn map of
// decision F2): zoom, pan, full screen, scale, popups. Park areas, the search radius and pathways are map layers;
// sites are focusable HTML markers with a popup. Everything shown comes from the server props – the page keeps a
// list with the same information, so the map is never the only way to reach a site (and it may fail to load).
//
// Every element sits on a white casing and a shadow, so it stands out from the colourful base map (user, 2026-11-27:
// "the interactive elements are lame and do not stand out"). Glass look on top (user choice 2026-11-28, preview
// "Karte: transparenter, professioneller Look", Karte:A + light veil): a light veil over the base map below its
// labels, translucent park areas with a soft inner glow, pathways that are pale at the sender and full at the
// receiver (no arrows), one colour per material (user, 2026-11-28; legend under the map), and frosted pathway letters
// and popups.
//
// `interactive` (the industrial map and the regional map, not the start page): a layer bar above the map, "show
// all", a hover state on park areas, park areas that fade in and pathways that draw themselves one after the other
// once (light at the tip, ripple on arrival), markers and pathway letters that pop in once, a single ping on a
// selected or highlighted marker and comets travelling along the pathways (pathway-style.ts). Every motion is off with
// prefers-reduced-motion; the comets pause off screen and in a hidden tab.
//
// Texts inside popups come from the database (company and site names): they are always set as textContent, never
// as HTML.
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import type { PlatformMessages } from "@/i18n/platform";
import { arc, boundsOf, circleRing, sliceAlong, spreadOffsets, type GeoPoint, type Position } from "./geo";
import { markerClass, type MarkerKind } from "./marker-style";
import { flowAt, materialColour, PATHWAY_WASH, REVEAL, revealProgress, revealTotal, revealWindow, ripple, tipLight, type FlowFeature } from "./pathway-style";
import { popupContent, type PopupLink, type PopupSpec, type PopupStat } from "./popup-content";
import { EyeIcon, EyeOffIcon, MapIcon } from "@/components/ui/icons";
import { buttonQuiet } from "@/components/ui/elements";

/** Colourful vector style (water, parks, roads in colour; user, 2026-11-27) without a key or an account. It stays
 * light in the dark colour scheme too (user, 2026-11-27); popups and controls take the page tokens (globals.css). */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const INK = "#1d3127";
/** Layer colours = tokens --color-map-park / -radius / -flow in globals.css (the legend uses the tokens). */
const PARK = "#16a34a";
const RADIUS = "#2563eb";
const CASING = "#ffffff";
/** Glass look: the translucent casing under a pathway. */
const CASING_SOFT = "rgba(255, 255, 255, 0.55)";
/** Colour of a feature (its material, pathway-style.ts). */
const COLOUR: ExpressionSpecification = ["get", "c"];
/** Veil over the base map (below its labels): roads and areas recede, place names stay sharp. */
const VEIL = 0.2;
const FONT_BOLD = ["Noto Sans Bold"];

export type LiveMapLink = PopupLink;
/** Popup of a park: city with a pin, then optional lines, key figures, the named sites and links. */
export type LiveMapPark = GeoPoint & { id: number; name: string; city: string; radiusM: number; lines?: string[]; stats?: PopupStat[]; list?: PopupSpec["list"]; links?: LiveMapLink[] };
export type LiveMapMarker = GeoPoint & {
  id: number;
  /** Short text in the marker (a number matching the list). */
  label: string;
  kind: MarkerKind;
  title: string;
  /** Second line under the title (e.g. the site under the company). */
  subtitle?: string;
  /** Place line with a pin (e.g. the park). */
  place?: string;
  stats?: PopupStat[];
  lines: string[];
  links: LiveMapLink[];
  /** Open its popup and move the map to it. */
  selected?: boolean;
  /** Part of a highlighted collection group. */
  highlighted?: boolean;
};
/** `material` sets the colour of the line, its letter and its popup; without it the line keeps the pathway orange. */
export type LiveMapPathway = { code: string; from: GeoPoint; to: GeoPoint | null; title: string; lines: string[]; tags?: string[]; material?: { key: string; name: string } };

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
  parks: ["kw-parks-fill", "kw-parks-glow", "kw-parks-casing", "kw-parks-line", "kw-park-names"],
  sites: [],
  flows: ["kw-pathways-band", "kw-pathways-casing", "kw-pathways-line", "kw-pathways-wash", "kw-flow-ripple", "kw-flow-trail-glow", "kw-flow-trail", "kw-flow-glow", "kw-flow-dots"],
  radius: ["kw-radius-casing", "kw-radius-line"],
};
/** Swatch of each toggle, the same colours as the layers. */
const SWATCH: Record<LayerKey, string> = {
  parks: "size-3 rounded-full border-2 border-map-park bg-map-park/30",
  sites: "size-3 rounded-full bg-map-offer",
  flows: "h-[3px] w-4 rounded-full bg-map-flow",
  radius: "size-3 rounded-full border-2 border-dashed border-map-radius",
};
/** The comets are redrawn at most ~50 times a second: a smooth glide for a few dozen tiny features. */
const FLOW_FRAME_MS = 20;

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

/** Air between an opened popup and the map frame; more at the bottom, where the map credits sit (two lines at 360 px). */
const POPUP_AIR = 12;
const POPUP_AIR_BOTTOM = 52;

/**
 * MapLibre has no auto-pan: a popup near the edge of a narrow map reached over the frame and lost its right part
 * (found 2026-11-28 at 360 px). After opening – and after a centring move that is still running – the map moves just
 * far enough that the whole popup lies inside; a popup larger than the frame keeps its top left corner visible.
 */
function keepInFrame(map: MapLibreMap, popup: Popup, reduceMotion: boolean): Popup {
  const fit = () => {
    if (!popup.isOpen()) return;
    const frame = map.getContainer().getBoundingClientRect();
    const box = popup.getElement().getBoundingClientRect();
    const shift = (start: number, end: number, frameStart: number, frameEnd: number, endAir: number) =>
      start < frameStart + POPUP_AIR ? start - frameStart - POPUP_AIR : end > frameEnd - endAir ? Math.min(end - frameEnd + endAir, start - frameStart - POPUP_AIR) : 0;
    const dx = shift(box.left, box.right, frame.left, frame.right, POPUP_AIR);
    const dy = shift(box.top, box.bottom, frame.top, frame.bottom, POPUP_AIR_BOTTOM);
    if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: reduceMotion ? 0 : 300 });
  };
  popup.on("open", () => requestAnimationFrame(() => (map.isMoving() ? map.once("moveend", fit) : fit())));
  return popup;
}

const featureCollection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const polygon = (ring: Position[], properties: Record<string, unknown> = {}, id?: number): GeoJSON.Feature => ({ type: "Feature", id, properties, geometry: { type: "Polygon", coordinates: [ring] } });
const lineString = (line: Position[], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates: line } });
const pointFeature = (point: GeoPoint, properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [point.longitude, point.latitude] } });

const hover: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
const kind = (k: "trail" | "head" | "ripple"): ExpressionSpecification => ["==", ["get", "k"], k];

/** Our sources and layers, added once after the style has loaded; later only their data changes. Every line lies on
 * a translucent white casing, so it never blends into roads or rivers of the base map. */
function addLayers(map: MapLibreMap) {
  const empty = featureCollection([]);
  for (const id of ["kw-parks", "kw-park-labels", "kw-radius", "kw-flow"]) map.addSource(id, { type: "geojson", data: empty });
  map.addSource("kw-pathways", { type: "geojson", data: empty, lineMetrics: true });
  // The veil lies below the first label layer of the base style, so place and road names stay on top of it.
  const firstLabel = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
  map.addSource("kw-veil", { type: "geojson", data: polygon([[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]) });
  map.addLayer({ id: "kw-veil", type: "fill", source: "kw-veil", paint: { "fill-color": CASING, "fill-opacity": VEIL } }, firstLabel);
  map.addLayer({ id: "kw-parks-fill", type: "fill", source: "kw-parks", paint: { "fill-color": PARK, "fill-opacity": ["case", hover, 0.22, 0.12] } });
  // soft glow inside the boundary: the rings run clockwise, so a positive offset points inwards
  map.addLayer({ id: "kw-parks-glow", type: "line", source: "kw-parks", paint: { "line-color": PARK, "line-width": 16, "line-blur": 14, "line-offset": 6, "line-opacity": 0.28 } });
  map.addLayer({ id: "kw-parks-casing", type: "line", source: "kw-parks", paint: { "line-color": CASING, "line-width": ["case", hover, 5, 4], "line-opacity": 0.55 } });
  map.addLayer({ id: "kw-parks-line", type: "line", source: "kw-parks", paint: { "line-color": PARK, "line-width": ["case", hover, 2.5, 1.5], "line-opacity": 0.85 } });
  map.addLayer({ id: "kw-radius-casing", type: "line", source: "kw-radius", paint: { "line-color": CASING, "line-width": 5, "line-opacity": 0.85 } });
  map.addLayer({ id: "kw-radius-line", type: "line", source: "kw-radius", paint: { "line-color": RADIUS, "line-width": 2.5, "line-dasharray": [3, 2] } });
  const round = { "line-cap": "round", "line-join": "round" } as const;
  // Pathway: soft band in its colour, translucent white casing, the line, and a white wash that fades it at the sender.
  map.addLayer({ id: "kw-pathways-band", type: "line", source: "kw-pathways", layout: round, paint: { "line-color": COLOUR, "line-opacity": 0.2, "line-width": 12, "line-blur": 3 } });
  map.addLayer({ id: "kw-pathways-casing", type: "line", source: "kw-pathways", layout: round, paint: { "line-color": CASING_SOFT, "line-width": 5.5 } });
  map.addLayer({ id: "kw-pathways-line", type: "line", source: "kw-pathways", layout: round, paint: { "line-color": COLOUR, "line-width": 3 } });
  map.addLayer({ id: "kw-pathways-wash", type: "line", source: "kw-pathways", layout: round, paint: { "line-gradient": PATHWAY_WASH, "line-width": 3 } });
  // Motion (pathway-style.ts): ripple rings at the receiver, comet tails – a white core over a blurred glow in the
  // material colour, so the comet shines on its own line (butt caps: the pieces do not overlap into beads) – and the
  // light itself, a soft coloured glow around a white core.
  map.addLayer({
    id: "kw-flow-ripple",
    type: "circle",
    source: "kw-flow",
    filter: kind("ripple"),
    paint: { "circle-radius": ["get", "w"], "circle-color": COLOUR, "circle-opacity": ["*", 0.14, ["get", "o"]], "circle-stroke-color": COLOUR, "circle-stroke-width": 2, "circle-stroke-opacity": ["get", "o"] },
  });
  const butt = { "line-cap": "butt", "line-join": "round" } as const;
  map.addLayer({
    id: "kw-flow-trail-glow",
    type: "line",
    source: "kw-flow",
    filter: kind("trail"),
    layout: butt,
    paint: { "line-color": COLOUR, "line-width": ["*", 2.6, ["get", "w"]], "line-blur": ["*", 1.2, ["get", "w"]], "line-opacity": ["*", 0.7, ["get", "o"]] },
  });
  map.addLayer({ id: "kw-flow-trail", type: "line", source: "kw-flow", filter: kind("trail"), layout: butt, paint: { "line-color": CASING, "line-width": ["*", 0.6, ["get", "w"]], "line-opacity": ["get", "o"] } });
  map.addLayer({ id: "kw-flow-glow", type: "circle", source: "kw-flow", filter: kind("head"), paint: { "circle-radius": 16, "circle-blur": 1, "circle-color": COLOUR, "circle-opacity": ["*", 0.7, ["get", "o"]] } });
  map.addLayer({
    id: "kw-flow-dots",
    type: "circle",
    source: "kw-flow",
    filter: kind("head"),
    paint: { "circle-radius": 3.8, "circle-color": CASING, "circle-stroke-color": COLOUR, "circle-stroke-width": 2, "circle-opacity": ["get", "o"], "circle-stroke-opacity": ["get", "o"] },
  });
  map.addLayer({
    id: "kw-park-names",
    type: "symbol",
    source: "kw-park-labels",
    layout: { "text-field": ["get", "name"], "text-font": FONT_BOLD, "text-size": 14, "text-max-width": 12, "text-anchor": "bottom", "text-offset": [0, -0.5] },
    paint: { "text-color": INK, "text-halo-color": "rgba(255, 255, 255, 0.85)", "text-halo-width": 2, "text-halo-blur": 1 },
  });
}

/** Park areas at `fade` (0…1) of their entrance. */
function paintParks(map: MapLibreMap, fade: number) {
  map.setPaintProperty("kw-parks-glow", "line-opacity", 0.28 * fade);
  map.setPaintProperty("kw-parks-fill", "fill-opacity", ["case", hover, 0.22 * fade, 0.12 * fade]);
  map.setPaintProperty("kw-parks-casing", "line-opacity", 0.55 * fade);
  map.setPaintProperty("kw-parks-line", "line-opacity", 0.85 * fade);
}

type DrawnLine = { pathway: LiveMapPathway; line: Position[]; middle: Position; colour: string };
/** Pathways that have a receiver, as the curves drawn on the map, each with its material colour. */
const pathwayLines = (pathways: LiveMapPathway[]): DrawnLine[] =>
  pathways.flatMap((pathway, index) => (pathway.to ? [{ pathway, colour: materialColour(pathway.material?.key), ...arc(pathway.from, pathway.to, 0.18 + index * 0.06) }] : []));

/** The pathway lines, each drawn up to its share in `drawn` (all of it without); a line not started yet is left out. */
const pathwayData = (lines: DrawnLine[], drawn?: (index: number) => number) =>
  featureCollection(
    lines.flatMap(({ line, pathway, colour }, index) => {
      const share = drawn ? drawn(index) : 1;
      return share <= 0 ? [] : [lineString(share >= 1 ? line : sliceAlong(line, 0, share), { code: pathway.code, c: colour })];
    }),
  );

/** Unique materials of the pathways, for the legend. */
const materialsOf = (pathways: LiveMapPathway[]) => [...new Map(pathways.flatMap(({ material }) => (material ? [[material.key, material] as const] : []))).values()];

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
  /** performance.now() at which the entrance ends; the comets start only then. */
  const revealEnd = useRef(0);

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
    const pathwaySource = map.getSource("kw-pathways") as GeoJSONSource;
    const flowSource = map.getSource("kw-flow") as GeoJSONSource;
    pathwaySource.setData(pathwayData(lines));

    drawn.current.forEach(({ marker }) => marker.remove());
    const created: { marker: Marker; layer: LayerKey }[] = [];
    const animate = interactive && !reduceMotion;
    const enter = animate && !entered.current;
    entered.current = true;
    // The popup sits in the map container: on a narrow map it keeps 20 px air on each side, so MapLibre can still
    // place it fully inside the frame (found 2026-11-28 at 360 px, where 340 px reached over both edges).
    const POPUP_WIDTH = "min(340px, calc(100% - 40px))";
    const popupOf = (spec: PopupSpec) => keepInFrame(map, new lib.Popup({ offset: 20, maxWidth: POPUP_WIDTH, focusAfterOpen: true }).setDOMContent(popupContent(spec, navigate)), reduceMotion);

    // Park areas: a click on the area opens the park popup (names and links) – the list repeats them.
    const parkPopup = keepInFrame(map, new lib.Popup({ offset: 4, maxWidth: POPUP_WIDTH }), reduceMotion);
    const onParkClick = (event: { lngLat: { lng: number; lat: number }; features?: { properties: Record<string, unknown> }[] }) => {
      const park = parks.find((entry) => entry.id === Number(event.features?.[0]?.properties.id));
      if (!park) return;
      parkPopup
        .setLngLat(event.lngLat)
        .setDOMContent(popupContent({ mark: { kind: "park" }, title: park.name, place: park.city, lines: park.lines, stats: park.stats, list: park.list, links: park.links }, navigate))
        .addTo(map);
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
    pathways.forEach((pathway) => {
      const drawnIndex = lines.findIndex((entry) => entry.pathway === pathway);
      const middle = drawnIndex >= 0 ? lines[drawnIndex].middle : null;
      const colour = materialColour(pathway.material?.key);
      const key = `${pathway.from.latitude},${pathway.from.longitude}`;
      const slot = middle ? 0 : (hanging.get(key) ?? 0);
      if (!middle) hanging.set(key, slot + 1);
      const { element, visual } = markerButton(
        // frosted glass: translucent white over a blurred map, letter and rim in the material colour (≥ 4.5:1 on white)
        "grid size-8 place-items-center rounded-full border bg-white/72 text-[14px] leading-none font-bold shadow-[0_6px_18px_rgb(16_32_24/0.16),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-[6px] backdrop-saturate-[1.3] transition-[scale] duration-150 ease-out group-hover:scale-110 motion-reduce:transition-none group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#1d3127]",
        pathway.code,
        `${t.pathway} ${pathway.code}: ${pathway.title}`,
      );
      visual.style.color = colour;
      visual.style.borderColor = `${colour}80`; // half transparent rim
      if (enter) {
        visual.classList.add("kw-enter");
        // as its line arrives; a letter without a line with the first line
        visual.style.setProperty("--kw-delay", `${drawnIndex >= 0 ? revealWindow(drawnIndex).end - 200 : REVEAL.leadMs}ms`);
      }
      const marker = new lib.Marker({ element, offset: middle ? [0, 0] : [(slot % 2 === 0 ? -1 : 1) * Math.ceil(slot / 2) * 32, 34] })
        .setLngLat(middle ?? [pathway.from.longitude, pathway.from.latitude])
        .setPopup(popupOf({ mark: { kind: "flow", text: pathway.code, colour }, eyebrow: `${t.pathway} ${pathway.code}`, title: pathway.title, tags: pathway.tags, lines: pathway.lines }))
        .addTo(map);
      created.push({ marker, layer: "flows" });
    });

    // Sites: focusable buttons; sites that would cover each other on screen are spread on a small circle (spread()).
    const sites: Marker[] = [];
    markers.forEach((entry, index) => {
      const { element, visual } = markerButton(markerClass(entry.kind, entry.highlighted), entry.label, `${entry.label}: ${entry.title}${entry.subtitle ? ` – ${entry.subtitle}` : ""}`);
      if (enter) {
        visual.classList.add("kw-enter");
        visual.style.setProperty("--kw-delay", `${Math.min(index, 8) * 50}ms`); // staggered, at most 8 steps
      }
      // One ping when a marker becomes the selected one or part of the highlighted group.
      if (animate && (entry.selected || entry.highlighted)) visual.classList.add("kw-ping");
      const marker = new lib.Marker({ element }).setLngLat([entry.longitude, entry.latitude]).setPopup(popupOf({ mark: { kind: "site" }, title: entry.title, subtitle: entry.subtitle, place: entry.place, stats: entry.stats, lines: entry.lines, links: entry.links })).addTo(map);
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
    // Entrance, once per page visit: park areas fade in, then the pathways draw themselves one after the other with a
    // light at the tip and a ripple at the receiver (pathway-style.ts).
    let reveal = 0;
    const finishReveal = () => {
      paintParks(map, 1);
      pathwaySource.setData(pathwayData(lines));
      flowSource.setData(featureCollection([]));
    };
    if (enter) {
      const started = performance.now();
      const total = revealTotal(lines.length);
      revealEnd.current = started + total;
      const frame = (now: number) => {
        // the first frame time can lie before `started` → never below 0
        const elapsed = Math.max(now - started, 0);
        paintParks(map, 1 - (1 - Math.min(elapsed / REVEAL.parksMs, 1)) ** 3);
        pathwaySource.setData(pathwayData(lines, (index) => revealProgress(index, elapsed)));
        flowSource.setData(
          featureCollection(
            lines.flatMap(({ line, colour }, index): FlowFeature[] => [
              ...tipLight(line, revealProgress(index, elapsed), colour),
              ...ripple(line[line.length - 1], (elapsed - revealWindow(index).end) / REVEAL.rippleMs, colour),
            ]),
          ),
        );
        if (elapsed < total) reveal = requestAnimationFrame(frame);
        else {
          reveal = 0;
          finishReveal();
        }
      };
      paintParks(map, 0);
      pathwaySource.setData(pathwayData(lines, () => 0));
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
        revealEnd.current = 0;
        finishReveal();
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

  // 5. Comets travelling along the pathways (pathway-style.ts): only on interactive maps, after the entrance, while
  // the map is on screen and the tab is visible, never with reduced motion (the pale-to-full line still shows the
  // direction).
  const flowing = interactive && state === "ready" && layers.flows && pathways.some((pathway) => pathway.to);
  useEffect(() => {
    const map = mapRef.current;
    const frame = container.current;
    if (!flowing || !map || !frame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = pathwayLines(pathways);
    const source = map.getSource("kw-flow") as GeoJSONSource;
    const start = Math.max(revealEnd.current, performance.now());
    let onScreen = true;
    let last = 0;
    let request = 0;
    const observer = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    observer.observe(frame);
    const draw = (now: number) => {
      request = requestAnimationFrame(draw);
      // the entrance owns the layer until it ends
      if (now < start || !onScreen || document.hidden || now - last < FLOW_FRAME_MS) return;
      last = now;
      source.setData(featureCollection(lines.flatMap(({ line, colour }, index) => flowAt(line, index, now - start, colour))));
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

  const materials = materialsOf(pathways);
  // the toggle of the pathways shows the colours of the materials on the map
  const flowColours = [...new Set(materials.map(({ key }) => materialColour(key)))];
  const swatchStyle = (key: LayerKey) => (key === "flows" && flowColours.length > 1 ? { backgroundImage: `linear-gradient(90deg, ${flowColours.join(", ")})` } : key === "flows" && flowColours.length === 1 ? { backgroundColor: flowColours[0] } : undefined);

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
            <span className={`flex-none ${SWATCH[key]}`} style={swatchStyle(key)} aria-hidden="true" />
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
      {/* Legend of the material colours, in the flow under the map (never on it); the popups name the material too. */}
      {materials.length > 0 && layers.flows && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] leading-snug text-ink">
          <span className="font-semibold">{t.ui.materials}:</span>
          <ul className="contents">
            {materials.map(({ key, name }) => (
              <li key={key} className="inline-flex items-center gap-2">
                <span className="h-1 w-5 flex-none rounded-full" style={{ backgroundColor: materialColour(key) }} aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
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

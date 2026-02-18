import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Search,
  Map as MapIcon,
  Navigation2,
  Layers,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Loader2,
  Clock,
  Milestone,
  List,
  History,
  AlertCircle,
  ChevronDown,
  RotateCcw,
  Plus,
  Minus,
  Compass,
} from "lucide-react";
import * as turf from "@turf/turf";

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loadingAgency, setLoadingAgency] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // --- STATE FOR SEARCH & DROPDOWNS ---
  const [allStops, setAllStops] = useState([]);
  const originRef = useRef(null);
  const destRef = useRef(null);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [searching, setSearching] = useState(false);
  const [originSearchTerm, setOriginSearchTerm] = useState("");
  const [destSearchTerm, setDestSearchTerm] = useState("");
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [showIntermediateStops, setShowIntermediateStops] = useState(false);


  const [agencies, setAgencies] = useState({
    cmrl: {
      name: "CMRL",
      table: "cmrl_master_production",
      color: "#0038A8",
      active: true,
      routesVisible: true,
      stopsVisible: true,
      labelsVisible: false,
      loaded: false,
    },
    srr: {
      name: "SRR",
      table: "srr_master",
      color: "#800000",
      active: false,
      routesVisible: true,
      stopsVisible: true,
      labelsVisible: false,
      loaded: false,
    },
    mtc: {
      name: "MTC",
      table: "mtc_master",
      color: "#FF8C00",
      active: false,
      routesVisible: true,
      stopsVisible: true,
      labelsVisible: false,
      loaded: false,
    },
  });

  const updateLayerVisibility = (
    key,
    agencyActive,
    routesOn,
    stopsOn,
    labelsOn,
  ) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer(`${key}-route-layer`)) {
      map.current.setLayoutProperty(
        `${key}-route-layer`,
        "visibility",
        agencyActive && routesOn ? "visible" : "none",
      );
    }
    if (map.current.getLayer(`${key}-stop-layer`)) {
      map.current.setLayoutProperty(
        `${key}-stop-layer`,
        "visibility",
        agencyActive && stopsOn ? "visible" : "none",
      );
    }
    if (map.current.getLayer(`${key}-stop-label-layer`)) {
      map.current.setLayoutProperty(
        `${key}-stop-label-layer`,
        "visibility",
        agencyActive && labelsOn ? "visible" : "none",
      );
    }
    // Handle route labels - only show if requested, but user specifically asked for them to be hidden
    if (map.current.getLayer(`${key}-route-label-layer`)) {
      map.current.setLayoutProperty(
        `${key}-route-label-layer`,
        "visibility",
        "none", // Permanently hidden as per user request
      );
    }
  };

  const fetchLayer = async (key, initialActive) => {
    const agency = agencies[key];
    if (map.current.getSource(key)) return;

    try {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/v1";
      const response = await fetch(`${apiBase}/api/layers/${agency.table}`);
      const data = await response.json();

      const stops = data.features
        .filter((f) => f.properties.feature_type?.toLowerCase() === "stop")
        .map((f) => ({
          name:
            f.properties.stop_name ||
            `Stop ${f.properties.stop_id || f.properties.fid}`,
          coords: f.geometry.coordinates,
          stop_id: f.properties.stop_id || f.properties.fid,
          agency: key,
          rawFeature: f, // Keep raw feature for snapping
        }));

      // Snap to line logic for Metro (CMRL)
      if (key === "cmrl") {
        const routes = data.features.filter(
          (f) =>
            f.properties.feature_type?.toLowerCase() === "route" &&
            f.geometry.type === "LineString",
        );

        if (routes.length > 0) {
          stops.forEach((stop) => {
            const point = turf.point(stop.coords);
            let nearestPoint = null;
            let minDistance = Infinity;

            routes.forEach((route) => {
              const snapped = turf.nearestPointOnLine(route, point);
              const distance = turf.distance(point, snapped);
              if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = snapped;
              }
            });

            // If snapped point is reasonably close (e.g., within 500m), use it
            if (nearestPoint && minDistance < 0.5) {
              stop.coords = nearestPoint.geometry.coordinates;
              // Update the original feature in 'data' so the source uses snapped coords
              const originalFeature = data.features.find(
                (f) =>
                  f.properties.stop_id === stop.stop_id &&
                  f.properties.feature_type === "stop",
              );
              if (originalFeature) {
                originalFeature.geometry.coordinates =
                  nearestPoint.geometry.coordinates;
              }
            }
          });
        }
      }

      setAllStops((prev) => {
        const newStops = [...prev, ...stops];
        const unique = Array.from(
          new Map(newStops.map((s) => [s.name, s])).values(),
        );
        return unique.sort((a, b) => a.name.localeCompare(b.name));
      });

      map.current.addSource(key, {
        type: "geojson",
        data: data,
        promoteId: key === "cmrl" ? "stop_id" : "fid",
      });

      const routeColor =
        key === "cmrl"
          ? [
            "case",
            ["has", "route_color"],
            [
              "case",
              ["==", ["slice", ["get", "route_color"], 0, 1], "#"],
              ["get", "route_color"],
              ["concat", "#", ["get", "route_color"]],
            ],
            agency.color,
          ]
          : agency.color;

      map.current.addLayer({
        id: `${key}-route-layer`,
        type: "line",
        source: key,
        filter: ["==", ["downcase", ["get", "feature_type"]], "route"],
        layout: {
          visibility:
            initialActive && agency.routesVisible ? "visible" : "none",
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": routeColor,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            2,
            14,
            6,
            18,
            10,
          ],
          "line-opacity": 0.85,
        },
      });

      map.current.addLayer({
        id: `${key}-stop-layer`,
        type: "circle",
        source: key,
        filter: ["==", ["downcase", ["get", "feature_type"]], "stop"],
        layout: {
          visibility: initialActive && agency.stopsVisible ? "visible" : "none",
        },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 8],
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": agency.color,
        },
      });

      // Stop Labels
      map.current.addLayer({
        id: `${key}-stop-label-layer`,
        type: "symbol",
        source: key,
        filter: ["==", ["downcase", ["get", "feature_type"]], "stop"],
        layout: {
          visibility:
            initialActive && agency.labelsVisible ? "visible" : "none",
          "text-field": ["get", "stop_name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 12,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
        },
        paint: {
          "text-color": agency.color,
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      // Route Labels
      map.current.addLayer({
        id: `${key}-route-label-layer`,
        type: "symbol",
        source: key,
        filter: ["==", ["downcase", ["get", "feature_type"]], "route"],
        layout: {
          visibility:
            initialActive && agency.labelsVisible ? "visible" : "none",
          "symbol-placement": "line",
          "text-field": ["get", "route_short_name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-offset": [0, -1],
        },
        paint: {
          "text-color": agency.color,
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      setAgencies((prev) => ({
        ...prev,
        [key]: { ...prev[key], loaded: true },
      }));
    } catch (err) {
      console.error(`Failed to fetch ${key}:`, err);
    }
  };

  const loadAndToggle = async (key, forceState = null) => {
    const agency = agencies[key];
    const isNowActive = forceState !== null ? forceState : !agency.active;

    if (isNowActive && !agency.loaded) {
      setLoadingAgency(agency.name);
      await fetchLayer(key, isNowActive);
      setLoadingAgency(null);
    } else {
      updateLayerVisibility(
        key,
        isNowActive,
        agency.routesVisible,
        agency.stopsVisible,
        agency.labelsVisible,
      );
    }
    setAgencies((prev) => ({
      ...prev,
      [key]: { ...prev[key], active: isNowActive },
    }));
  };

  const toggleSubOption = (key, type) => {
    setAgencies((prev) => {
      const updatedAgency = { ...prev[key], [type]: !prev[key][type] };
      updateLayerVisibility(
        key,
        updatedAgency.active,
        updatedAgency.routesVisible,
        updatedAgency.stopsVisible,
        updatedAgency.labelsVisible,
      );
      return { ...prev, [key]: updatedAgency };
    });
  };

  const handleSearch = async () => {
    if (!source || !destination || !map.current) return;

    setSearching(true);
    setRouteAnalysis(null);


    const startStation = allStops.find((s) => s.name === source);
    const endStation = allStops.find((s) => s.name === destination);

    if (startStation && endStation) {
      // Default zoom for direct route
      let fitBoundsZoom = 15;
      let fitBoundsPadding = 100;
      let fitBoundsDuration = 2000;
      let fitBoundsPitch = 45;
      let isTransfer = false;

      // We'll determine transfer after fetching route analysis
      let bounds = new maplibregl.LngLatBounds()
        .extend(startStation.coords)
        .extend(endStation.coords);

      try {
        const apiBase =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/v1";
        const response = await fetch(
          `${apiBase}/api/route-analysis?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`,
        );
        const data = await response.json();
        console.log(data);

        if (response.ok) {
          setRouteAnalysis(data);

          if (data.transfer) {
            isTransfer = true;
            fitBoundsZoom = 12;
          }

          if (data.exchange_point) {
            const exchangeStop = allStops.find(
              (s) => s.name === data.exchange_point,
            );
            if (exchangeStop) {
              bounds = bounds.extend(exchangeStop.coords);
            }
          }

          map.current.fitBounds(bounds, {
            padding: fitBoundsPadding,
            maxZoom: fitBoundsZoom,
            duration: fitBoundsDuration,
            pitch: fitBoundsPitch,
          });

          if (map.current.getSource("highlighted-source")) {
            map.current.getSource("highlighted-source").setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: startStation.coords,
                  },
                  properties: { name: source },
                },
              ],
            });
          }

          if (map.current.getSource("highlighted-destination")) {
            map.current.getSource("highlighted-destination").setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: endStation.coords,
                  },
                  properties: { name: destination },
                },
              ],
            });
          }

          // Highlight intermediate stops for all segments
          let allIntermediateStops = [];
          if (data.segments) {
            data.segments.forEach((seg) => {
              if (seg.intermediate_stops && seg.intermediate_stops.length > 0) {
                allIntermediateStops = allIntermediateStops.concat(
                  seg.intermediate_stops,
                );
              }
            });
          } else if (data.intermediate_stops) {
            allIntermediateStops = data.intermediate_stops;
          }
          // Highlight exchange point if present
          let exchangeFeature = null;
          if (data.exchange_point) {
            const exchangeStop = allStops.find(
              (s) => s.name === data.exchange_point,
            );
            if (exchangeStop) {
              exchangeFeature = {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: exchangeStop.coords,
                },
                properties: { name: data.exchange_point },
              };
            }
          }
          if (map.current.getSource("highlighted-intermediate")) {
            const intermediateFeatures = allIntermediateStops
              .map((stopName) => {
                const stop = allStops.find((s) => s.name === stopName);
                if (stop) {
                  return {
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: stop.coords,
                    },
                    properties: { name: stopName },
                  };
                }
                return null;
              })
              .filter((f) => f !== null);
            let features = intermediateFeatures;
            if (exchangeFeature) {
              features = [
                ...features,
                {
                  ...exchangeFeature,
                  properties: {
                    ...exchangeFeature.properties,
                    isExchange: true,
                  },
                },
              ];
            }
            map.current.getSource("highlighted-intermediate").setData({
              type: "FeatureCollection",
              features,
            });
          }

          let routeLineFeatures = [];
          if (data.segments && data.segments.length > 0) {
            data.segments.forEach((seg) => {
              Object.keys(agencies).forEach((agencyKey) => {
                const src = map.current.getSource(agencyKey);
                if (src && src._data && src._data.features) {
                  const match = src._data.features.find(
                    (f) =>
                      f.properties &&
                      f.properties.route_id &&
                      String(f.properties.route_id) === String(seg.route_id) &&
                      f.geometry.type === "LineString",
                  );
                  if (match) {
                    routeLineFeatures.push(match);
                  }
                }
              });
            });
          }
          routeLineFeatures = routeLineFeatures.filter(
            (f, idx, arr) =>
              arr.findIndex(
                (o) =>
                  JSON.stringify(o.geometry.coordinates) ===
                  JSON.stringify(f.geometry.coordinates),
              ) === idx,
          );
          if (!map.current.getSource("highlighted-route")) {
            map.current.addSource("highlighted-route", {
              type: "geojson",
              data: {
                type:
                  routeLineFeatures.length > 1
                    ? "FeatureCollection"
                    : "Feature",
                features: routeLineFeatures,
              },
            });
            map.current.addLayer({
              id: "highlighted-route-layer",
              type: "line",
              source: "highlighted-route",
              paint: {
                "line-color": "#f43f5e",
                "line-width": 12,
                "line-opacity": 0.92,
              },
            });
          } else {
            map.current.getSource("highlighted-route").setData({
              type:
                routeLineFeatures.length > 1 ? "FeatureCollection" : "Feature",
              features: routeLineFeatures,
            });
            if (map.current.getLayer("highlighted-route-layer")) {
              map.current.setPaintProperty(
                "highlighted-route-layer",
                "line-width",
                12,
              );
              map.current.setPaintProperty(
                "highlighted-route-layer",
                "line-opacity",
                0.92,
              );
            }
          }
        } else {
          console.error("Analysis failed:", data.error);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    } else {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setSource("");
    setDestination("");
    setOriginSearchTerm("");
    setDestSearchTerm("");
    setRouteAnalysis(null);
    setShowOriginSuggestions(false);
    setShowDestSuggestions(false);

    setShowIntermediateStops(false);

    if (map.current && map.current.getSource("highlighted-source")) {
      map.current.getSource("highlighted-source").setData({
        type: "FeatureCollection",
        features: [],
      });
    }
    if (map.current && map.current.getSource("highlighted-destination")) {
      map.current.getSource("highlighted-destination").setData({
        type: "FeatureCollection",
        features: [],
      });
    }
    if (map.current && map.current.getSource("highlighted-intermediate")) {
      map.current.getSource("highlighted-intermediate").setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (originRef.current && !originRef.current.contains(event.target)) {
        setShowOriginSuggestions(false);
      }
      if (destRef.current && !destRef.current.contains(event.target)) {
        setShowDestSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [80.22, 13.06],
      zoom: 13,
      pitch: 45, // 3D View
      bearing: -17,
      antialias: true,
    });

    map.current.on("load", () => {
      // Add 3D Buildings
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (l) => l.type === "symbol" && l.layout["text-field"],
      )?.id;

      map.current.addLayer({
        id: "3d-buildings",
        source: "carto",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#e0e0e0",
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-opacity": 0.6,
        },
      });
      map.current.addSource("highlighted-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "highlighted-source-layer",
        type: "circle",
        source: "highlighted-source",
        paint: {
          "circle-radius": 12,
          "circle-color": "#22c55e",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.current.addSource("highlighted-destination", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "highlighted-destination-layer",
        type: "circle",
        source: "highlighted-destination",
        paint: {
          "circle-radius": 12,
          "circle-color": "#ef4444",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.current.addSource("highlighted-intermediate", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "highlighted-intermediate-layer",
        type: "circle",
        source: "highlighted-intermediate",
        paint: {
          "circle-radius": 10,
          "circle-color": "#f59e0b",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.current.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true,
        }),
        "top-right",
      );

      loadAndToggle("cmrl", true);

      map.current.on("click", (e) => {
        const stopLayers = [
          "cmrl-stop-layer",
          "srr-stop-layer",
          "mtc-stop-layer",
        ];
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: stopLayers.filter((id) => map.current.getLayer(id)),
        });

        if (features.length > 0) {
          const feature = features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const name = feature.properties.stop_name || "Unknown Station";
          const agencyLabel = feature.layer.id.split("-")[0].toUpperCase();

          new maplibregl.Popup({
            className: "station-popup",
            closeButton: false,
          })
            .setLngLat(coordinates)
            .setHTML(
              `
              <div class="p-2 font-sans">
                <div class="text-[10px] fw-bold text-uppercase opacity-75">${agencyLabel} System</div>
                <div class="h6 mb-0 fw-black text-uppercase">${name}</div>
              </div>
            `,
            )
            .addTo(map.current);
        }
      });
    });

    return () => map.current.remove();
  }, []);

  return (
    <div
      className="w-100 bg-light"
      style={{
        height: "calc(100vh - 64px)",
        position: "relative",
        "--nav-offset": rightPanelCollapsed ? "64px" : "336px",
      }}
    >
      {/* LEFT PANEL: AGENCY CONTROLS */}
      <div
        className="position-absolute m-3 transition-all duration-300"
        style={{
          top: 0,
          left: 0,
          zIndex: 10,
          width: leftPanelCollapsed ? "48px" : "240px",
          height: leftPanelCollapsed ? "48px" : "auto",
        }}
        onMouseEnter={() => leftPanelCollapsed && null}
      >
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
          <div className="card-header bg-white border-bottom p-0">
            <div className="d-flex align-items-center justify-content-between p-3">
              <div
                className="d-flex align-items-center flex-grow-1 cursor-pointer"
                onClick={() =>
                  leftPanelCollapsed && setLeftPanelCollapsed(false)
                }
                title={leftPanelCollapsed ? "Layers" : ""}
              >
                <Layers
                  size={18}
                  className="text-[#1a2caa] me-2 flex-shrink-0"
                />
                {!leftPanelCollapsed && (
                  <h6 className="mb-0 fw-bold text-uppercase tracking-wider small text-muted">
                    Layers
                  </h6>
                )}
              </div>
              <button
                className="btn btn-link p-0 text-muted shadow-none border-0"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              >
                {leftPanelCollapsed ? (
                  <ChevronRight size={18} />
                ) : (
                  <ChevronLeft size={18} />
                )}
              </button>
            </div>
          </div>
          {!leftPanelCollapsed && (
            <div
              className="card-body p-2 scroll-modern"
              style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}
            >
              <div className="flex flex-col gap-3">
                {Object.keys(agencies).map((key) => (
                  <div
                    key={key}
                    className={`p-4 rounded-2xl transition-all duration-200 border shadow-sm ${agencies[key].active
                      ? "bg-white border-slate-200"
                      : "bg-white border-slate-100 opacity-80"
                      }`}
                  >
                    {/* Header / Main Toggle */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-base ${agencies[key].active ? "text-[#1a2caa]" : "text-slate-500"}`}
                        >
                          {agencies[key].name}
                        </span>
                        {loadingAgency === agencies[key].name && (
                          <Loader2
                            size={16}
                            className="text-blue-500 animate-spin"
                          />
                        )}
                      </div>

                      {/* The Toggle Switch Fix */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={agencies[key].active}
                          onChange={() => loadAndToggle(key)}
                          disabled={loadingAgency === agencies[key].name}
                        />
                        <div
                          style={{
                            backgroundColor: agencies[key].active
                              ? agencies[key].color
                              : "",
                          }}
                          className={`w-12 h-6 bg-slate-200 rounded-full peer 
              transition-colors duration-200 ease-in-out
              
              /* The Ball (Pseudo-element) */
              after:content-[''] 
              after:absolute after:top-[2px] after:start-[2px] 
              after:bg-white after:rounded-full after:h-5 after:w-5 
              after:transition-all after:duration-200 after:shadow-md
              
              /* Exact translation to hit the end of the track */
              peer-checked:after:translate-x-[24px] 
              ${loadingAgency === agencies[key].name ? "opacity-50" : ""}`}
                        ></div>
                      </label>
                    </div>

                    {/* Sub-options Accordion */}
                    {agencies[key].active && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                        {["routesVisible", "stopsVisible", "labelsVisible"].map(
                          (option) => (
                            <div
                              key={option}
                              className="flex items-center justify-between px-1"
                            >
                              <label className="text-xs text-[#1a2caa] uppercase font-bold tracking-widest">
                                {option.replace("Visible", "")}
                              </label>
                              <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-[#1a2caa] focus:ring-blue-500 transition-all cursor-pointer"
                                checked={agencies[key][option]}
                                onChange={() => toggleSubOption(key, option)}
                              />
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: ROUTE FINDER */}
      <div
        className="position-absolute m-3 transition-all duration-300"
        style={{
          top: 0,
          right: 0,
          zIndex: 10,
          width: rightPanelCollapsed ? "48px" : "320px",
          height: rightPanelCollapsed ? "48px" : "auto",
        }}
      >
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
          <div className="card-header bg-white border-bottom p-0">
            <div className="d-flex align-items-center justify-content-between p-3">
              <div
                className="d-flex align-items-center flex-grow-1 cursor-pointer"
                onClick={() =>
                  rightPanelCollapsed && setRightPanelCollapsed(false)
                }
                title={rightPanelCollapsed ? "Route Finder" : ""}
              >
                <Navigation2
                  size={18}
                  className="text-[#1a2caa] me-2 flex-shrink-0"
                />
                {!rightPanelCollapsed && (
                  <h6 className="mb-0 fw-bold text-uppercase tracking-wider small text-muted">
                    Route Finder
                  </h6>
                )}
              </div>
              <button
                className="btn btn-link p-0 text-muted shadow-none border-0"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              >
                {rightPanelCollapsed ? (
                  <ChevronLeft size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            </div>
          </div>
          {!rightPanelCollapsed && (
            <div
              className="card-body p-3 scroll-modern"
              style={{ maxHeight: "calc(100vh - 140px)", overflowY: "auto", overflowX: "hidden" }}
            >
              <div className="vstack gap-3">
                <div className="position-relative" ref={originRef}>
                  <div className="d-flex align-items-center mb-2">
                    <label className="small fw-bold text-muted text-uppercase m-0 tracking-tighter">
                      Origin Stop
                    </label>
                  </div>
                  <div className="input-group input-group-sm ux-search-group">
                    <span className="input-group-text bg-light border-0 rounded-start-3">
                      <Search size={14} className="text-[#1a2caa]" />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 shadow-none p-2"
                      placeholder="Type or select Origin..."
                      value={source || originSearchTerm}
                      onChange={(e) => {
                        setOriginSearchTerm(e.target.value);
                        setSource("");
                        setShowOriginSuggestions(true);
                        setRouteAnalysis(null);
                      }}
                      onFocus={() => setShowOriginSuggestions(true)}
                      style={{ fontSize: "0.85rem" }}
                    />
                    <span
                      className="input-group-text bg-light border-0 rounded-end-3 cursor-pointer"
                      onClick={() =>
                        setShowOriginSuggestions(!showOriginSuggestions)
                      }
                    >
                      <ChevronDown size={14} className="text-secondary" />
                    </span>
                  </div>
                  {showOriginSuggestions && allStops.length > 0 && (
                    <ul
                      className="list-group position-absolute w-100 shadow-lg border-0 mt-1 rounded-3"
                      style={{
                        zIndex: 100,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {allStops
                        .filter((s) =>
                          s.name
                            .toLowerCase()
                            .includes(originSearchTerm.toLowerCase()),
                        )
                        .slice(0, 50) // Performance: only show first 50 matches
                        .map((s) => (
                          <li
                            key={s.stop_id}
                            className="list-group-item list-group-item-action border-0 px-3 py-2 small cursor-pointer"
                            onClick={() => {
                              setSource(s.name);
                              setOriginSearchTerm(s.name);
                              setShowOriginSuggestions(false);
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{s.name}</span>
                              <span
                                className="badge rounded-pill bg-light text-dark extra-small text-uppercase opacity-50"
                                style={{ fontSize: "0.6rem" }}
                              >
                                {s.agency}
                              </span>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <div className="position-relative" ref={destRef}>
                  <div className="d-flex align-items-center mb-2">
                    <label className="small fw-bold text-muted text-uppercase m-0 tracking-tighter">
                      Destination Stop
                    </label>
                  </div>
                  <div className="input-group input-group-sm ux-search-group">
                    <span className="input-group-text bg-light border-0 rounded-start-3">
                      <Search size={14} className="text-[#1a2caa]" />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-0 shadow-none p-2"
                      placeholder="Type or select Destination..."
                      value={destination || destSearchTerm}
                      onChange={(e) => {
                        setDestSearchTerm(e.target.value);
                        setDestination("");
                        setShowDestSuggestions(true);
                        setRouteAnalysis(null);
                      }}
                      onFocus={() => setShowDestSuggestions(true)}
                      style={{ fontSize: "0.85rem" }}
                    />
                    <span
                      className="input-group-text bg-light border-0 rounded-end-3 cursor-pointer"
                      onClick={() =>
                        setShowDestSuggestions(!showDestSuggestions)
                      }
                    >
                      <ChevronDown size={14} className="text-secondary" />
                    </span>
                  </div>
                  {showDestSuggestions && allStops.length > 0 && (
                    <ul
                      className="list-group position-absolute w-100 shadow-lg border-0 mt-1 rounded-3"
                      style={{
                        zIndex: 100,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {allStops
                        .filter((s) =>
                          s.name
                            .toLowerCase()
                            .includes(destSearchTerm.toLowerCase()),
                        )
                        .slice(0, 50)
                        .map((s) => (
                          <li
                            key={s.stop_id}
                            className="list-group-item list-group-item-action border-0 px-3 py-2 small cursor-pointer"
                            onClick={() => {
                              setDestination(s.name);
                              setDestSearchTerm(s.name);
                              setShowDestSuggestions(false);
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{s.name}</span>
                              <span
                                className="badge rounded-pill bg-light text-dark extra-small text-uppercase opacity-50"
                                style={{ fontSize: "0.6rem" }}
                              >
                                {s.agency}
                              </span>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-row gap-2 w-full mt-2">
                  <button
                    className="btn ux-btn-primary rounded-3 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    onClick={handleSearch}
                    disabled={!source || !destination || searching}
                    style={{
                      backgroundColor: "#1a2caa",
                      border: "none",
                      height: "42px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {searching ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Navigation2 size={18} />
                    )}
                    <span>{searching ? "Analyzing..." : "Find Route"}</span>
                  </button>

                  <button
                    className="btn rounded-3 fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2 transition-all hover:bg-light focus:outline-none focus:ring-2 focus:ring-offset-1"
                    onClick={handleReset}
                    style={{
                      fontSize: "0.85rem",
                      border: "1px dashed #ccc",
                      color: "#555",
                      backgroundColor: "#fff",
                      height: "42px",
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Embedded Trip Analysis */}
                {routeAnalysis && (
                  <div className="mt-3 animate animate-fade-in border-t pt-3">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="mb-0 text-[#1a2caa] fw-bold text-uppercase small tracking-widest d-flex align-items-center gap-2">
                        <History size={16} />
                        Trip Analysis
                      </h6>
                      <button
                        className="btn btn-close shadow-none small opacity-50"
                        style={{ fontSize: "0.5rem" }}
                        onClick={() => setRouteAnalysis(null)}
                      ></button>
                    </div>

                    <div className="mb-3">
                      <div className="row g-2 mb-3">
                        <div className="col-4">
                          <div className="bg-light p-2 rounded-3 text-center border-bottom border-blue-200 border-2">
                            <div className="text-muted extra-small text-uppercase">
                              Time
                            </div>
                            <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                              {routeAnalysis.total_duration_minutes || "--"}
                              <span className="ms-1" style={{ fontSize: "0.65rem" }}>
                                min
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-4">
                          <div className="bg-light p-2 rounded-3 text-center border-bottom border-blue-200 border-2">
                            <div className="text-muted extra-small text-uppercase">
                              Stops
                            </div>
                            <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                              {routeAnalysis.total_stops || "0"}
                            </div>
                          </div>
                        </div>
                        <div className="col-4">
                          <div className="bg-light p-2 rounded-3 text-center border-bottom border-blue-200 border-2">
                            <div className="text-muted extra-small text-uppercase">
                              Transfer
                            </div>
                            <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                              {routeAnalysis.transfer ? "Yes" : "No"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {routeAnalysis.exchange_point && (
                        <div className="mb-2">
                          <span className="badge bg-warning text-dark px-2 py-1 rounded-pill">
                            Exchange at: {routeAnalysis.exchange_point.includes("PURATCHI THALAIVAR") ? "MGR Central Metro" : routeAnalysis.exchange_point}
                          </span>
                        </div>
                      )}

                      {routeAnalysis.segments &&
                        routeAnalysis.segments.map((seg, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-3 shadow-sm mb-2 border border-2"
                            style={{ borderColor: "#bfdbfe" }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <Milestone size={14} className="text-muted" />
                                <span className="small fw-bold text-muted">
                                  Segment {idx + 1}: {seg.from} → {seg.to}
                                </span>
                              </div>
                              <span
                                className="badge extra-small border"
                                style={{
                                  backgroundColor: "#eef2ff",
                                  color: "#1a2caa",
                                  borderColor: "#c7d2fe",
                                }}
                              >
                                {seg.route_id}
                              </span>
                            </div>
                            <div className="h6 text-[#1a2caa] fw-black text-uppercase mb-1">
                              {seg.route_long_name}
                            </div>
                            <div className="small text-muted d-flex align-items-center gap-1 mb-1">
                              <MapIcon size={12} />
                              <span>
                                Towards {seg.trip_headsign || "Destination"}
                              </span>
                            </div>
                            <div className="row g-2 mb-1">
                              <div className="col-4">
                                <div className="text-muted extra-small text-uppercase">
                                  Time
                                </div>
                                <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                                  {seg.duration_minutes || "--"}
                                  <span
                                    className="ms-1"
                                    style={{ fontSize: "0.65rem" }}
                                  >
                                    min
                                  </span>
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="text-muted extra-small text-uppercase">
                                  Stops
                                </div>
                                <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                                  {seg.stops_count || "0"}
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="text-muted extra-small text-uppercase">
                                  Dist.
                                </div>
                                <div className="fw-bold h6 mb-0 text-[#1a2caa]">
                                  {seg.direct_distance_km
                                    ? parseFloat(seg.direct_distance_km).toFixed(1)
                                    : "--"}
                                  <span
                                    className="ms-1"
                                    style={{ fontSize: "0.65rem" }}
                                  >
                                    km
                                  </span>
                                </div>
                              </div>
                            </div>
                            {seg.intermediate_stops &&
                              seg.intermediate_stops.length > 0 && (
                                <div className="mt-2 mb-3">
                                  <button
                                    className="btn btn-sm btn-link p-0 text-muted shadow-none d-flex align-items-center gap-1 w-100 justify-content-between"
                                    onClick={() =>
                                      setShowIntermediateStops(
                                        showIntermediateStops === idx ? null : idx,
                                      )
                                    }
                                  >
                                    <span className="text-uppercase small fw-bold tracking-tighter">
                                      Intermediate Stops
                                    </span>
                                    <div className="d-flex align-items-center gap-1">
                                      <span className="extra-small opacity-50">
                                        {seg.intermediate_stops.length} stops
                                      </span>
                                      <ChevronRight
                                        size={14}
                                        style={{
                                          transform:
                                            showIntermediateStops === idx
                                              ? "rotate(90deg)"
                                              : "none",
                                          transition: "transform 0.2s",
                                        }}
                                      />
                                    </div>
                                  </button>
                                  {showIntermediateStops === idx && (
                                    <div className="mt-2 animate animate-fade-in">
                                      <div className="vstack gap-2 border-start ms-2 ps-3">
                                        {seg.intermediate_stops.map((stop, sidx) => (
                                          <div
                                            key={sidx}
                                            className="small text-muted position-relative"
                                          >
                                            <div
                                              className="position-absolute start-0 top-50 translate-middle-x bg-light rounded-circle"
                                              style={{
                                                width: "6px",
                                                height: "6px",
                                                marginLeft: "-15px",
                                              }}
                                            ></div>
                                            {stop}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TRIP ANALYSIS FLOATING CARD - Horizontal sliding toggle */}


      <div
        className="position-absolute m-3 mt-4 transition-all duration-300"
        style={{
          bottom: 0,
          left: 0,
          zIndex: 10,
          width: legendCollapsed ? "48px" : "220px",
          height: legendCollapsed ? "48px" : "auto",
        }}
      >
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
          <div className="card-header bg-white border-bottom p-0" style={{ height: legendCollapsed ? "100%" : "auto", borderBottom: legendCollapsed ? "none" : "inherit" }}>
            <div
              className={`d-flex align-items-center ${legendCollapsed ? "justify-content-center h-100" : "justify-content-between p-2 px-3"}`}
            >
              <div
                className={`d-flex align-items-center ${legendCollapsed ? "justify-content-center w-100 h-100" : "flex-grow-1"} cursor-pointer`}
                onClick={() => legendCollapsed && setLegendCollapsed(false)}
                title={legendCollapsed ? "Show Map Legend" : ""}
              >
                <List size={20} className="text-[#1a2caa] flex-shrink-0" />
                {!legendCollapsed && (
                  <h6 className="mb-0 ms-2 fw-bold text-uppercase tracking-wider extra-small text-muted">
                    Map Legend
                  </h6>
                )}
              </div>
              {!legendCollapsed && (
                <button
                  className="btn btn-link p-0 text-muted shadow-none border-0"
                  onClick={() => setLegendCollapsed(true)}
                >
                  <ChevronLeft size={18} />
                </button>
              )}
            </div>
          </div>
          {!legendCollapsed && (
            <div className="card-body p-3">
              <div className="vstack gap-2">
                {agencies.cmrl.active && (
                  <>
                    <div className="d-flex align-items-center gap-2">
                      <div
                        style={{
                          width: "12px",
                          height: "3px",
                          backgroundColor: "#000092",
                          borderRadius: "2px",
                        }}
                      ></div>
                      <span className="extra-small fw-semibold text-muted">
                        CMRL Blue Line
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div
                        style={{
                          width: "12px",
                          height: "3px",
                          backgroundColor: "#00A700",
                          borderRadius: "2px",
                        }}
                      ></div>
                      <span className="extra-small fw-semibold text-muted">
                        CMRL Green Line
                      </span>
                    </div>
                  </>
                )}
                {agencies.srr.active && (
                  <div className="d-flex align-items-center gap-2">
                    <div
                      style={{
                        width: "12px",
                        height: "3px",
                        backgroundColor: agencies.srr.color,
                        borderRadius: "2px",
                      }}
                    ></div>
                    <span className="extra-small fw-semibold text-muted">
                      Suburban Rail
                    </span>
                  </div>
                )}
                {agencies.mtc.active && (
                  <div className="d-flex align-items-center gap-2">
                    <div
                      style={{
                        width: "12px",
                        height: "3px",
                        backgroundColor: agencies.mtc.color,
                        borderRadius: "2px",
                      }}
                    ></div>
                    <span className="extra-small fw-semibold text-muted">
                      MTC Bus Routes
                    </span>
                  </div>
                )}
                {(agencies.cmrl.active ||
                  agencies.srr.active ||
                  agencies.mtc.active) && (
                    <div className="d-flex align-items-center gap-2 mt-1 pt-1 border-top">
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          border: "2px solid #555",
                        }}
                      ></div>
                      <span className="extra-small fw-semibold text-muted">
                        Station / Stop
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div ref={mapContainer} className="w-100 h-100" />

      <style>{`
        .extra-small { font-size: 0.65rem; }
        .station-popup .maplibregl-popup-content {
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border: none;
        }
        .scroll-modern::-webkit-scrollbar {
          width: 4px;
          height: 0px; /* Hide horizontal scrollbar */
        }
        .scroll-modern::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .scroll-modern::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .scroll-modern::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }

         .maplibregl-ctrl-top-right {
          right: 16px !important;
          transition: all 0.3s ease-in-out;
          margin-top: ${rightPanelCollapsed ? "80px" : "16px"} !important;
        }
      `}</style>
    </div>
  );
};

export default MapComponent;

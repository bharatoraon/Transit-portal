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
} from "lucide-react";

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loadingAgency, setLoadingAgency] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // --- STATE FOR SEARCH & DROPDOWNS ---
  const [cmrlStops, setCmrlStops] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

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
    if (map.current.getLayer(`${key}-route-label-layer`)) {
      map.current.setLayoutProperty(
        `${key}-route-label-layer`,
        "visibility",
        agencyActive && labelsOn ? "visible" : "none",
      );
    }
  };

  const fetchLayer = async (key, initialActive) => {
    const agency = agencies[key];
    if (map.current.getSource(key)) return;

    try {
      const response = await fetch(
        `http://localhost:3000/v1/api/layers/${agency.table}`,
      );
      const data = await response.json();

      if (key === "cmrl") {
        const stops = data.features
          .filter((f) => f.properties.feature_type?.toLowerCase() === "stop")
          .map((f) => ({
            name: f.properties.stop_name || `Station ${f.properties.fid}`,
            coords: f.geometry.coordinates,
            fid: f.properties.fid,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCmrlStops(stops);
      }

      map.current.addSource(key, {
        type: "geojson",
        data: data,
        promoteId: "fid",
      });

      const routeColor =
        key === "cmrl"
          ? [
              "match",
              ["get", "route_color"],
              "#000092",
              "#000092",
              "#00A700",
              "#00A700",
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
            5,
            18,
            8,
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

  const handleSearch = () => {
    if (!source || !destination || !map.current) return;
    const startStation = cmrlStops.find((s) => s.name === source);
    const endStation = cmrlStops.find((s) => s.name === destination);

    if (startStation && endStation) {
      const bounds = new maplibregl.LngLatBounds()
        .extend(startStation.coords)
        .extend(endStation.coords);
      map.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 15,
        duration: 2000,
        pitch: 45,
      });
    }
  };

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

      map.current.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true,
        }),
        "bottom-right",
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
      style={{ height: "calc(100vh - 64px)", position: "relative" }}
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
                    className={`p-4 rounded-2xl transition-all duration-200 border shadow-sm ${
                      agencies[key].active
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
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden h-100">
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
                  <h6 className="mb-0 fw-bold text-uppercase tracking-widest small text-muted">
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
            <div className="card-body p-3">
              <div className="vstack gap-3">
                <div className="position-relative">
                  <div className="d-flex align-items-center mb-2">
                    <label className="small fw-bold text-muted text-uppercase m-0 tracking-tighter">
                      Origin Stop
                    </label>
                  </div>
                  <select
                    className="form-select ux-form-select bg-light border-0 rounded-3 shadow-none p-2 ps-3"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">Select Source...</option>
                    {cmrlStops.map((s) => (
                      <option key={s.fid} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="position-relative">
                  <div className="d-flex align-items-center mb-2">
                    <label className="small fw-bold text-muted text-uppercase m-0 tracking-tighter">
                      Destination Stop
                    </label>
                  </div>
                  <select
                    className="form-select ux-form-select bg-light border-0 rounded-3 shadow-none p-2 ps-3"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">Select Destination...</option>
                    {cmrlStops.map((s) => (
                      <option key={s.fid} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-primary w-100 rounded-3 fw-bold py-2 shadow-sm text-uppercase d-flex align-items-center justify-content-center transition-all hover-shadow mt-2"
                  style={{
                    backgroundColor: "#1a2caa",
                    borderColor: "#1a2caa",
                    letterSpacing: "0.5px",
                  }}
                  onClick={handleSearch}
                >
                  <Search size={16} className="me-2" /> Find Route
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM RIGHT: LEGEND (to the left of NavigationControl) */}
      <div
        className="position-absolute m-3"
        style={{ bottom: 0, right: "50px", zIndex: 10, width: "220px" }}
      >
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
          <div className="card-header bg-white border-bottom p-2 px-3">
            <div className="d-flex align-items-center">
              <Info size={14} className="text-secondary me-2" />
              <h6 className="mb-0 fw-bold text-uppercase tracking-wider extra-small text-muted">
                Map Legend
              </h6>
            </div>
          </div>
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
      `}</style>
    </div>
  );
};

export default MapComponent;

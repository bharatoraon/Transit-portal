import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loadingAgency, setLoadingAgency] = useState(null);

  // --- STATE FOR SEARCH & DROPDOWNS ---
  const [cmrlStops, setCmrlStops] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const [agencies, setAgencies] = useState({
    cmrl: {
      name: "CMRL",
      table: "cmrl_master_production",
      color: "#007bff",
      active: true,
      routesVisible: true,
      stopsVisible: true,
      loaded: false,
    },
    srr: {
      name: "SRR",
      table: "srr_master",
      color: "#800000",
      active: false,
      routesVisible: true,
      stopsVisible: true,
      loaded: false,
    },
    mtc: {
      name: "MTC",
      table: "mtc_master",
      color: "#FF8C00",
      active: false,
      routesVisible: true,
      stopsVisible: true,
      loaded: false,
    },
  });

  const updateLayerVisibility = (key, agencyActive, routesOn, stopsOn) => {
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
  };

  const fetchLayer = async (key, initialActive) => {
    const agency = agencies[key];
    if (map.current.getSource(key)) return;

    try {
      const response = await fetch(
        `http://localhost:3000/v1/api/layers/${agency.table}`,
      );
      const data = await response.json();

      // Extract stops for dropdown if CMRL
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
              "#0000FF", 
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
          "line-width": 4,
          "line-opacity": 0.8,
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 10],
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#000000",
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
      });
    }
  };

  useEffect(() => {
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [80.22, 13.06],
      zoom: 11,
    });

    map.current.on("load", () => {
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

          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(
              `
              <div style="padding: 8px; font-family: sans-serif; min-width: 120px;">
                <b style="color: #333; font-size: 14px;">${name}</b><br/>
                <span style="color: #666; font-size: 11px;">Agency: ${agencyLabel}</span>
              </div>
            `,
            )
            .addTo(map.current);
        }
      });

      map.current.on("mousemove", (e) => {
        const stopLayers = [
          "cmrl-stop-layer",
          "srr-stop-layer",
          "mtc-stop-layer",
        ];
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: stopLayers.filter((id) => map.current.getLayer(id)),
        });
        map.current.getCanvas().style.cursor = features.length ? "pointer" : "";
      });
    });

    return () => map.current.remove();
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div
        className="card shadow border-0 position-absolute m-4"
        style={{
          top: 0,
          left: 0,
          zIndex: 10,
          width: "320px",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
        }}
      >
        <div className="card-body">

          <div className="mb-4 pb-4 border-bottom">
            <h4
              className="card-title h6 fw-bold text-primary mb-3 text-uppercase"
              style={{ color: "#0038A8" }}
            >
              CMRL Route Finder
            </h4>
            <div className="vstack gap-3">
              <select
                className="form-select form-select-sm border-0 bg-light"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Source Station</option>
                {cmrlStops.map((s) => (
                  <option key={s.fid} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm border-0 bg-light"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Destination Station</option>
                {cmrlStops.map((s) => (
                  <option key={s.fid} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-sm fw-bold text-uppercase w-100"
                style={{ backgroundColor: "#0038A8", borderColor: "#0038A8" }}
                onClick={handleSearch}
              >
                Find & Zoom
              </button>
            </div>
          </div>

          <h3 className="card-subtitle h6 text-muted text-uppercase mb-3 fw-bold small">
            Active Agencies
          </h3>

          <div className="vstack gap-3">
            {Object.keys(agencies).map((key) => (
              <div
                key={key}
                className="p-3 border rounded-3 bg-light bg-opacity-50"
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-dark small text-uppercase">
                    {agencies[key].name}
                  </span>
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input cursor-pointer"
                      type="checkbox"
                      role="switch"
                      checked={agencies[key].active}
                      onChange={() => loadAndToggle(key)}
                      disabled={loadingAgency === agencies[key].name}
                      style={{
                        backgroundColor: agencies[key].active
                          ? agencies[key].color
                          : undefined,
                        borderColor: agencies[key].active
                          ? agencies[key].color
                          : undefined,
                        width: "2.5rem",
                        height: "1.25rem",
                      }}
                    />
                  </div>
                </div>

                {agencies[key].active && (
                  <div className="mt-3 pt-2 border-top border-secondary border-opacity-10 vstack gap-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`${key}-routes-toggle`}
                        checked={agencies[key].routesVisible}
                        onChange={() => toggleSubOption(key, "routesVisible")}
                      />
                      <label
                        className="form-check-label small text-muted text-uppercase font-monospace"
                        htmlFor={`${key}-routes-toggle`}
                      >
                        Routes
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`${key}-stops-toggle`}
                        checked={agencies[key].stopsVisible}
                        onChange={() => toggleSubOption(key, "stopsVisible")}
                      />
                      <label
                        className="form-check-label small text-muted text-uppercase font-monospace"
                        htmlFor={`${key}-stops-toggle`}
                      >
                        Stops
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {loadingAgency && (
            <div className="mt-4 d-flex align-items-center justify-content-center text-muted small opacity-50">
              <div
                className="spinner-border spinner-border-sm me-2 text-primary"
                role="status"
              ></div>
              <span className="text-uppercase font-monospace small">
                Fetching {loadingAgency}
              </span>
            </div>
          )}
        </div>
      </div>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default MapComponent;

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loadingAgency, setLoadingAgency] = useState(null);
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
      color: "#28a745",
      active: false,
      routesVisible: true,
      stopsVisible: true,
      loaded: false,
    },
    mtc: {
      name: "MTC",
      table: "mtc_master",
      color: "#ff4d4d",
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

      map.current.addSource(key, {
        type: "geojson",
        data: data,
        promoteId: "fid",
      });

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
          "line-color": agency.color,
          "line-width": 3,
          "line-opacity": 0.7,
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 10],
          "circle-color": "#FF69B4",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
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
  useEffect(() => {
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [80.22, 13.06],
      zoom: 11,
    });

    map.current.on("load", () => {
      loadAndToggle("cmrl", true);
    });

    return () => map.current.remove();
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div style={sidebarStyle}>
        <h3
          style={{
            fontSize: "16px",
            marginBottom: "15px",
            borderBottom: "1px solid #eee",
            paddingBottom: "5px",
          }}
        >
          Agencies
        </h3>
        {Object.keys(agencies).map((key) => (
          <div key={key} style={agencyContainer}>
            <div style={toggleRow}>
              <span style={{ fontWeight: "bold" }}>{agencies[key].name}</span>
              <button
                onClick={() => loadAndToggle(key)}
                disabled={loadingAgency === agencies[key].name}
                style={{
                  backgroundColor: agencies[key].active
                    ? agencies[key].color
                    : "#ccc",
                  ...buttonStyle,
                  opacity: loadingAgency === agencies[key].name ? 0.6 : 1,
                }}
              >
                {loadingAgency === agencies[key].name
                  ? "..."
                  : agencies[key].active
                    ? "ON"
                    : "OFF"}
              </button>
            </div>

            <div
              style={{
                paddingLeft: "10px",
                marginTop: "5px",
                display: agencies[key].active ? "block" : "none",
              }}
            >
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={agencies[key].routesVisible}
                  onChange={() => toggleSubOption(key, "routesVisible")}
                />{" "}
                Routes
              </label>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={agencies[key].stopsVisible}
                  onChange={() => toggleSubOption(key, "stopsVisible")}
                />{" "}
                Stops
              </label>
            </div>
          </div>
        ))}
        {loadingAgency && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "11px",
              color: "#666",
              fontStyle: "italic",
            }}
          >
            Loading {loadingAgency}...
          </div>
        )}
      </div>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

// Styles (same as before)
const sidebarStyle = {
  position: "absolute",
  top: "20px",
  left: "20px",
  zIndex: 10,
  background: "white",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
  width: "200px",
};
const agencyContainer = { marginBottom: "15px", padding: "5px" };
const toggleRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const buttonStyle = {
  border: "none",
  color: "white",
  padding: "4px 10px",
  borderRadius: "20px",
  cursor: "pointer",
  transition: "0.3s",
  width: "55px",
  fontSize: "12px",
};
const checkboxLabel = {
  display: "block",
  fontSize: "13px",
  cursor: "pointer",
  marginTop: "3px",
};

export default MapComponent;

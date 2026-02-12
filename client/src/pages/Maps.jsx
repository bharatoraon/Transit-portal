import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loadingAgency, setLoadingAgency] = useState(null);

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
        agencyActive && routesOn ? "visible" : "none"
      );
    }
    if (map.current.getLayer(`${key}-stop-layer`)) {
      map.current.setLayoutProperty(
        `${key}-stop-layer`,
        "visibility",
        agencyActive && stopsOn ? "visible" : "none"
      );
    }
  };

  const fetchLayer = async (key, initialActive) => {
    const agency = agencies[key];
    if (map.current.getSource(key)) return;

    try {
      const response = await fetch(
        `http://localhost:3000/v1/api/layers/${agency.table}`
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

const routeColor = key === "cmrl" 
  ? [
      "match",
      ["get", "route_color"],
      "#000092", "#0000FF", 
      "#00A700", "#00A700", 
      agency.color 
    ]
  : agency.color; 

map.current.addLayer({
  id: `${key}-route-layer`,
  type: "line",
  source: key,
  filter: ["==", ["downcase", ["get", "feature_type"]], "route"],
  layout: {
    visibility: initialActive && agency.routesVisible ? "visible" : "none",
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
        agency.stopsVisible
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
        updatedAgency.stopsVisible
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
        const stopLayers = ["cmrl-stop-layer", "srr-stop-layer", "mtc-stop-layer"];
        
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: stopLayers.filter(id => map.current.getLayer(id))
        });

        if (features.length > 0) {
          const feature = features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const name = feature.properties.stop_name || "Unknown Station";
          const agencyLabel = feature.layer.id.split('-')[0].toUpperCase();

          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div style="padding: 8px; font-family: sans-serif; min-width: 120px;">
                <b style="color: #333; font-size: 14px;">${name}</b><br/>
                <span style="color: #666; font-size: 11px;">Agency: ${agencyLabel}</span>
              </div>
            `)
            .addTo(map.current);
        }
      });

      // Change cursor to pointer on stops
      map.current.on("mousemove", (e) => {
        const stopLayers = ["cmrl-stop-layer", "srr-stop-layer", "mtc-stop-layer"];
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: stopLayers.filter(id => map.current.getLayer(id))
        });
        map.current.getCanvas().style.cursor = features.length ? "pointer" : "";
      });
    });

    return () => map.current.remove();
  }, []);

  return (
    <div className="w-full h-screen relative bg-zinc-50 flex flex-col">
      <div className="absolute top-6 left-6 z-10 w-72 bg-white border border-zinc-200 rounded-sm shadow-sm p-5 overflow-y-auto max-h-[calc(100vh-48px)]">
        
        <div className="mb-6 pb-6 border-b border-zinc-200">
          <h4 className="text-sm font-bold text-[#0038A8] uppercase tracking-wider mb-4">
            CMRL Route Finder
          </h4>
          <div className="space-y-3">
            <select 
              className="w-full h-10 px-3 py-2 bg-white border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0038A8] appearance-none cursor-pointer"
              value={source} 
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Source Station</option>
              {cmrlStops.map((s) => (
                <option key={s.fid} value={s.name}>{s.name}</option>
              ))}
            </select>
            <select 
              className="w-full h-10 px-3 py-2 bg-white border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0038A8] appearance-none cursor-pointer"
              value={destination} 
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">Destination Station</option>
              {cmrlStops.map((s) => (
                <option key={s.fid} value={s.name}>{s.name}</option>
              ))}
            </select>
            <button 
              className="w-full py-2.5 bg-[#0038A8] text-white font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-blue-800 transition-colors shadow-sm"
              onClick={handleSearch}
            >
              Find & Zoom
            </button>
          </div>
        </div>

        <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4 tracking-tighter">
          Active Agencies
        </h3>
        
        <div className="space-y-4">
          {Object.keys(agencies).map((key) => (
            <div key={key} className="p-3 border border-zinc-100 rounded-sm">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-800 uppercase tracking-tight">
                  {agencies[key].name}
                </span>
                <button
                  onClick={() => loadAndToggle(key)}
                  disabled={loadingAgency === agencies[key].name}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    agencies[key].active ? "" : "bg-zinc-200"
                  }`}
                  style={{ backgroundColor: agencies[key].active ? agencies[key].color : undefined }}
                >
                  <span
                    className={`${
                      agencies[key].active ? "translate-x-6" : "translate-x-1"
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </button>
              </div>

              {agencies[key].active && (
                <div className="mt-3 pt-3 border-t border-zinc-50 space-y-2">
                  <label className="flex items-center text-xs text-zinc-600 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 border-zinc-300 rounded-sm text-[#0038A8] focus:ring-[#0038A8] mr-2"
                      checked={agencies[key].routesVisible} 
                      onChange={() => toggleSubOption(key, "routesVisible")} 
                    /> 
                    <span className="group-hover:text-zinc-900 transition-colors uppercase font-mono tracking-tighter">Routes</span>
                  </label>
                  <label className="flex items-center text-xs text-zinc-600 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 border-zinc-300 rounded-sm text-[#0038A8] focus:ring-[#0038A8] mr-2"
                      checked={agencies[key].stopsVisible} 
                      onChange={() => toggleSubOption(key, "stopsVisible")} 
                    /> 
                    <span className="group-hover:text-zinc-900 transition-colors uppercase font-mono tracking-tighter">Stops</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {loadingAgency && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic animate-pulse">
            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
            <span>Fetching {loadingAgency}</span>
          </div>
        )}
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default MapComponent;

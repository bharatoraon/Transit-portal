import React, { useState, useEffect } from "react";
import { animate } from "framer-motion";
import { Link } from "react-router-dom";
import {ArrowRight} from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const RollingNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.floor(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
};

let cachedStats = null;

const HomePage = () => {
  const [stats, setStats] = useState(
    cachedStats || {
      routes: 842, 
      stops: 3521,
      agencies: 3,
    },
  );
  const [loading, setLoading] = useState(!cachedStats);

  useEffect(() => {
    
    if (cachedStats) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("https://transitdata-hub-chennai.onrender.com:3000/v1/api/stats");
        if (!response.ok) throw new Error("Failed to fetch stats");
        const data = await response.json();
        cachedStats = data; 
        setStats(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="ux-bg-light min-vh-100">
      <main className="container py-5">
        <section className="mb-5">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <h1
                className="display-5 mt-4 fw-bold mb-4 text-[#1a2caa]"
                style={{ letterSpacing: "-1.5px" }}
              >
                The Open Data Backbone for Chennai’s Mobility.
              </h1>
              <p className="lead text-secondary mb-5">
                A unified repository for static GTFS datasets, network
                visualizations for the Chennai Metropolitan Area.
              </p>
            </div>
            <div className="col-lg-5 d-flex justify-content-center">
              <DotLottieReact
                src="../../multi_model_video.json"
                loop
                autoplay
                className="img-fluid"
                style={{ maxHeight: "350px" }}
              />
            </div>
          </div>

          <div className="row g-0 border rounded shadow-sm bg-white mt-4 overflow-hidden">
            <div className="col-md-4 p-4 border-end">
              <p className="text-uppercase text-muted small fw-bold mb-1 ">
                Total Indexed Routes
              </p>
              <h2
                className="display-5 fw-bold text "
                style={{ color: "#1a2caa" }}
              >
                <RollingNumber value={stats.routes} />
              </h2>
            </div>
            <div className="col-md-4 p-4 border-end">
              <p className="text-uppercase text-muted small fw-bold mb-1 ">
                Mapped Stops
              </p>
              <h2
                className="display-5 fw-bold text "
                style={{ color: "#1a2caa" }}
              >
                <RollingNumber value={stats.stops} />
              </h2>
            </div>
            <div className="col-md-4 p-4">
              <p className="text-uppercase text-muted small fw-bold mb-1 ">
                Active Agencies
              </p>
              <h2
                className="display-5 fw-bold text"
                style={{ color: "#1a2caa" }}
              >
                <RollingNumber value={stats.agencies} />
              </h2>
            </div>
          </div>
        </section>

        <div className="row g-4 mb-5">
          <div className="col-md-6">
            <Link to="/maps" className="text-decoration-none h-100 d-block">
              <div className="card h-100 border-0 shadow-sm hover-shadow transition-all p-4">
                <div className="card-body p-0">
                  <h3
                    className="card-title fw-bold mb-3"
                    style={{ color: "#0038A8" }}
                  >
                    Interactive Network Map
                  </h3>
                  <p className="card-text text-secondary mb-4">
                    Explore multi-modal transit corridors, stop locations, and
                    static schedule visualizations.
                  </p>
                  <div
                    className=" d-flex align-items-center fw-bold text-uppercase small tracking-wider"
                    style={{ color: "#1a2caa" }}
                  >
                    Launch Viewer <ArrowRight className="ms-2" size={16} />
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <div className="col-md-6">
            <Link to="/datasets" className="text-decoration-none h-100 d-block">
              <div className="card h-100 border-0 shadow-sm hover-shadow transition-all p-4">
                <div className="card-body p-0">
                  <h3
                    className="card-title fw-bold mb-3"
                    style={{ color: "#1a2caa" }}
                  >
                    GTFS Repository
                  </h3>
                  <p className="card-text text-secondary mb-4">
                    Download verified static datasets for MTC, Metro, and
                    Suburban rail in standard .zip format.
                  </p>
                  <div
                    className="d-flex align-items-center fw-bold text-uppercase small tracking-wider"
                    style={{ color: "#1a2caa" }}
                  >
                    Browse Datasets <ArrowRight className="ms-2" size={16} />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="mt-5 pt-4">
          <div className="flex items-baseline-last mb-5">
            <h2 className="fw-bold me-1 mb-0" style={{ color: "#0038A8" }}>
              Key Stakeholders
            </h2>
            <div
              className="flex-grow-1 bg-[#1a2caa] rounded-pill"
              style={{ height: "3px", backgroundColor: "#0038A8" }}
            ></div>
          </div>

          <div className="row justify-content-center g-5 text-center">
            {[
              {
                name: "Southern railways",
                img: "../../suburban_logo.png",
              },
              {
                name: "Metropolitan Transport Corporation",
                img: "../../mtc_logo.jpg",
              },
              {
                name: "Chennai Metro Rail Ltd.",
                img: "../../cmrl_logo.png",
              },
            ].map((agency, idx) => (
              <div key={idx} className="col-6 col-md-3">
                <div
                  className="bg-white rounded-circle shadow-sm border p-4 mx-auto mb-3 d-flex align-items-center justify-center"
                  style={{ width: "120px", height: "120px" }}
                >
                  <img
                    src={agency.img}
                    alt={agency.name}
                    className="img-fluid"
                    style={{ maxHeight: "100%" }}
                  />
                </div>
                <span
                  className="text-uppercase fw-bold text-muted xsmall tracking-tighter d-block mx-auto"
                  style={{ fontSize: "11px", maxWidth: "150px" }}
                >
                  {agency.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;

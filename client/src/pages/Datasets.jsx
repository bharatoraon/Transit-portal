import React from "react";
import {
  Download,
  FileText,
  Info,
  Calendar,
  HardDrive,
  CheckCircle2,
} from "lucide-react";

const datasets = [
  {
    id: "mtc-bus",
    agency: "MTC Bus",
    description:
      "Metropolitan Transport Corporation (Chennai) bus routes, stop locations, and trip frequencies.",
    version: "2026.01.15",
    lastUpdated: "Jan 15, 2026",
    size: "14.2 MB",
    files: [
      "agency.txt",
      "stops.txt",
      "routes.txt",
      "trips.txt",
      "stop_times.txt",
      "shapes.txt",
      "frequencies.txt",
    ],
    status: "Stable",
  },
  {
    id: "cmrl-metro",
    agency: "Chennai Metro (CMRL)",
    description:
      "Chennai Metro Rail Limited official schedules, station coordinates, and fare rules for Blue and Green lines.",
    version: "2026.02.01",
    lastUpdated: "Feb 02, 2026",
    size: "2.8 MB",
    files: [
      "agency.txt",
      "stops.txt",
      "routes.txt",
      "trips.txt",
      "stop_times.txt",
      "fare_attributes.txt",
      "fare_rules.txt",
    ],
    status: "Updated",
  },
  {
    id: "suburban-rail",
    agency: "Suburban Rail",
    description:
      "Southern Railways Suburban network data covering North, South, and West lines in the CMA.",
    version: "2025.12.10",
    lastUpdated: "Dec 10, 2025",
    size: "4.1 MB",
    files: [
      "agency.txt",
      "stops.txt",
      "routes.txt",
      "trips.txt",
      "stop_times.txt",
    ],
    status: "Archive",
  },
];

const DatasetPage = () => {
  return (
    <div className="ux-bg-light min-vh-100">
      <header className="py-4">
        <div className="row align-items-center px-21">
          <div className="col-lg-7">
            <h1
              className="display-5 mt-4 fw-bold mb-4 text-[#1a2caa]"
              style={{ letterSpacing: "-1.5px" }}
            >
              Data Catalog
            </h1>
            <p className="lead text-secondary mb-5 mt-">
              Download Chennai's public transit data in standardized GTFS
              formats. All datasets are provided under the Open Data License for
              public use.
            </p>
          </div>
          <div className="col-lg-5 d-flex justify-content-center">
            <img
              src="../../multimodeltransport.jpg"
              alt="multimodeltransport"
              className="img-fluid rounded-lg mb-4"
              style={{ maxHeight: "350px" }}
            />
          </div>
        </div>
      </header>

      <main className="container pb-5">
        <div className="vstack gap-4">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="card shadow-sm border-0 overflow-hidden"
            >
              <div className="row g-0">
                <div className="col-md-8 p-4 p-lg-5">
                  <h3
                    className="card-title h3 fw-bold mb-3"
                    style={{ color: "#1a2caa" }}
                  >
                    {ds.agency}
                  </h3>
                  <p
                    className="card-text text-secondary mb-4 lead font-body"
                    style={{ fontSize: "1rem" }}
                  >
                    {ds.description}
                  </p>

                  <div className="row row-cols-auto mt-auto">
                    <div className="col d-flex align-items-center gap-2 text-muted">
                      <Calendar size={16} />
                      <span className="small fw-bold text-uppercase">
                        Updated: {ds.lastUpdated}
                      </span>
                    </div>
                    <div className="col d-flex align-items-center gap-2 text-muted">
                      <HardDrive size={16} />
                      <span className="small fw-bold text-uppercase">
                        Size: {ds.size}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-md-4 bg-light p-4 d-flex flex-column justify-content-between border-start">
                  <div>
                    <h4 className="h6 text-muted text-uppercase fw-bold mb-3 d-flex align-items-center gap-2 opacity-75">
                      <FileText size={14} /> Included Files
                    </h4>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {ds.files.map((file) => (
                        <span
                          key={file}
                          className="badge bg-white text-secondary border font-monospace py-1 px-2 fw-normal"
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const fileMap = {
                        "mtc-bus": "/static_mtc_gtfs_data.zip",
                        "cmrl-metro": "/CMRL gtfs.zip",
                        "suburban-rail": "/Southern Railways.zip",
                      };

                      const filePath = fileMap[ds.id];
                      if (!filePath) return;

                      const link = document.createElement("a");
                      link.href = filePath;
                      link.setAttribute("download", filePath.split("/").pop());
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="btn btn-primary fw-bold text-uppercase py-3 tracking-widest w-100"
                    style={{
                      backgroundColor: "#0038A8",
                      borderColor: "#0038A8",
                    }}
                  >
                    Download ZIP
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default DatasetPage;

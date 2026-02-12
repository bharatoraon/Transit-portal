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
    <div className="min-h-screen">
      <header className="bg-white max-w-7xl mx-auto pt-12 px-38">
        <div className="flex-1">
          <h1 className="text-3xl mt-6 md:text-5xl text-[#0038A8] font-bold tracking-tighter mb-4 md:mb-6 max-w-3xl">
            DATA CATALOG
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-2xl md:mb-10">
            Download Chennai's public transit data in standardized GTFS formats.
            All datasets are provided under the Open Data License for public
            use.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-12">
        <div className="space-y-8">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="bg-white border border-zinc-200 rounded-sm overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-8 flex-1 border-r border-zinc-100">
                <h3 className="text-2xl pt-6 font-bold text-[#0038A8] mb-3">
                  {ds.agency}
                </h3>
                <p className="text-gray-700 text-sm mb-6 leading-relaxed">
                  {ds.description}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Calendar size={14} />
                    <span className="text-xs font-medium">
                      Updated: {ds.lastUpdated}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600">
                    <HardDrive size={14} />
                    <span className="text-xs font-medium">Size: {ds.size}</span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 p-8 w-full md:w-80 flex flex-col justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={12} /> Included Files
                  </h4>
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {ds.files.map((file) => (
                      <span
                        key={file}
                        className="text-[10px] font-mono bg-white border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-600"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const map = {
                      "mtc-bus": "/static_mtc_gtfs_data.zip",
                      "cmrl-metro": "/CMRL gtfs.zip",
                      "suburban-rail": "/Southern Railways.zip",
                    };

                    const filePath = map[ds.id];
                    if (!filePath) return;

                    const link = document.createElement("a");
                    link.href = filePath;
                    link.setAttribute("download", filePath.split("/").pop());
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full bg-[#0038A8] text-white font-bold text-xs py-3 rounded-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors tracking-widest uppercase"
                >
                  <Download size={14} /> Download ZIP
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default DatasetPage;

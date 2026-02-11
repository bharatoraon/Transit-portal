import React, { useState, useEffect } from "react";
import { animate } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Database,
  Map,
  LayoutGrid,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

// Counter Component for that "Data Loading" feel
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

const HomePage = () => {
  return (
    <div className="min-h-screen  selection:bg-blue-100">
      <main className="max-w-7xl mx-auto px-6 py-12">
        <section className="mb-16">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-0">
            <div className="flex-1">
              <h1 className="text-3xl mt-3 md:text-5xl text-[#0038A8] font-bold tracking-tighter mb-4 md:mb-6 max-w-3xl">
                The Open Data Backbone for Chennai’s Mobility.
              </h1>
              <p className="text-lg md:text-xl text-gray-700 max-w-2xl mb-6 mt-10 md:mb-10">
                A unified repository for static GTFS datasets, network
                visualizations for the Chennai Metropolitan Area.
              </p>
            </div>
            <div className="w-full md:w-[450px] flex justify-center">
              <DotLottieReact
                src="../../multi_model_video.json"
                loop
                autoplay
                className="h-auto w-full max-w-[400px] md:max-w-none pb-4"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-zinc-200 rounded-sm overflow-hidden bg-white shadow-sm">
            <div className="p-8 border-r border-zinc-200">
              <p className="text-xs font-mono text-zinc-500 uppercase mb-2">
                Total Indexed Routes
              </p>
              <h2 className="text-4xl text-[#0038A8] font-bold font-mono">
                <RollingNumber value={842} />
              </h2>
            </div>
            <div className="p-8 border-r border-zinc-200">
              <p className="text-xs font-mono text-zinc-500 uppercase mb-2">
                Mapped Stops
              </p>
              <h2 className="text-4xl text-[#0038A8] font-bold font-mono">
                <RollingNumber value={3521} />
              </h2>
            </div>
            <div className="p-8">
              <p className="text-xs font-mono text-zinc-600 uppercase mb-2">
                Active Agencies
              </p>
              <h2 className="text-4xl text-[#0038A8] font-bold font-mono">
                <RollingNumber value={3} />
              </h2>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ">
          <Link
            to="/maps"
            className="group p-8 border border-zinc-200 bg-white  transition-all cursor-pointer relative overflow-hidden"
          >
            <h3 className="text-xl font-bold mb-2 text-[#0038A8]">
              Interactive Network Map
            </h3>
            <p className="mb-6 text-gray-700">
              Explore multi-modal transit corridors, stop locations, and static
              schedule visualizations.
            </p>
            <div className="flex text-[#0038A8] items-center text-sm font-bold uppercase tracking-wider">
              Launch Viewer <ArrowRight className="ml-2 w-4 h-4" />
            </div>
          </Link>

          <Link
            to="/datasets"
            className="group p-8 border border-zinc-200 bg-white transition-all cursor-pointer"
          >
            <h3 className="text-xl font-bold  mb-2 text-[#0038A8]">
              GTFS Repository
            </h3>
            <p className="mb-6 text-gray-700">
              Download verified static datasets for MTC, Metro, and Suburban
              rail in standard .zip format.
            </p>
            <div className="flex text-[#0038A8] items-center text-sm font-bold uppercase tracking-wider">
              Browse Datasets <ArrowRight className="ml-2 w-4 h-4" />
            </div>
          </Link>
        </div>

        <div className="mt-12 md:mt-18 px-4 md:px-6">
          <div className="flex items-center mb-10 gap-4">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0038A8] whitespace-normal md:whitespace-nowrap leading-tight">
              Departments we work with
            </h2>
            <div className="h-[3px] bg-[#0038A8] flex-grow rounded-full min-w-[20px]"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-12 gap-x-6 lg:ml-50 md:ml-10 ml-0">
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
              <div
                key={idx}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6 flex items-center justify-center p-4 bg-white rounded-full shadow-sm border border-zinc-100 transition-all duration-300 group-hover:shadow-md">
                  <img
                    src={agency.img}
                    alt={agency.name}
                    className="max-h-full max-w-full transition-all"
                  />
                </div>

                <span className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-tighter max-w-[130px] md:max-w-[150px]">
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

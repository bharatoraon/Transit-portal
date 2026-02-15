import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-zinc-200 w-full sticky top-0 z-[100]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 group">
            <div className="w-22 h-22 flex items-center justify-center">
              <img src="../../cumta_logo.png" alt="Logo" />
            </div>
            <span className="text-md font-black text-[#1a2caa] leading-none tracking-tighter uppercase">
              Transit Data Chennai
            </span>
          </div>

          <div className="hidden md:flex items-center h-full">
            <NavLink to="/" current={location.pathname === "/"}>
              Home
            </NavLink>
            <NavLink to="/maps" current={location.pathname === "/maps"}>
              Maps
            </NavLink>
            <NavLink to="/datasets" current={location.pathname === "/datasets"}>
              Datasets
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
};

const NavLink = ({ to, children, current }) => (
  <Link
    to={to}
    className={`px-5 h-16 flex items-center text-[#1a2caa] text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
      current
        ? "text-[#1a2caa] border-[#1a2caa] "
        : "text-[#1a2caa] border-transparent hover:text-zinc-900 hover:bg-zinc-50"
    }`}
  >
    {children}
  </Link>
);

export default Navbar;

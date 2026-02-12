import React from "react";
import {
  Github,
  Mail,
  ExternalLink,
  Database,
  Map as MapIcon,
  Phone,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
} from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#0038A8] text-white pointer-events-auto relative z-50 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1">
            <div className="flex items-center gap-1 mb-6">
              <img
                src="../../cumta_logo.png"
                alt="Cumta_logo"
                className="w-24 h-8 bg-white rounded-sm"
              ></img>
              <div className="flex flex-col text-white">
                <span className="text-lg pl-1 font-bold tracking-tight uppercase leading-none">
                  CUMTA
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed opacity-80 mb-6">
              Chennai Unified Metropolitan Transport Authority (CUMTA) is the
              nodal agency for coordinating and monitoring the implementation of
              various transport projects in the Chennai Metropolitan Area.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/cumtachennai/"
                className="opacity-70 hover:opacity-100 hover:text-white transition-all text-white"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://x.com/cumtaofficial"
                className="opacity-70 hover:opacity-100 hover:text-white transition-all text-white"
              >
                <Twitter size={18} />
              </a>
              <a
                href="https://www.linkedin.com/company/chennai-unified-metropolitan-transport-authority-cumta/"
                className="opacity-70 hover:opacity-100 hover:text-white transition-all  text-white"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="https://www.facebook.com/people/CUMTA-Chennai/100084011167997/?mibextid=LQQJ4d"
                className="opacity-70 hover:opacity-100 hover:text-white transition-all text-white"
              >
                <Facebook size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-2">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[
                { name: "Cumta", link: "https://cumta.tn.gov.in/#/" },
                { name: "Home", link: "/" },
                { name: "Maps", link: "/maps" },
                { name: "Datasets", link: "/datasets" },
              ].map((item) => (
                <li
                  key={item.name}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0"></span>
                  <a
                    href={item.link}
                    className="text-[15px] opacity-80 group-hover:opacity-100  text-white group-hover:text-white transition-all"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-2">Stakeholders</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 "></span>
                <a
                  href="https://mtcbus.tn.gov.in/"
                  target="_blank"
                  className="text-[15px]  opacity-80 group-hover:opacity-100 group-hover:text-white  text-white transition-all"
                >
                  Metropolitan Transport Corporation (MTC)
                </a>
              </li>
              <li className="flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 "></span>
                <a
                  href="https://chennaimetrorail.org/"
                  target="_blank"
                  className="text-[15px] opacity-80 group-hover:opacity-100 group-hover:text-white  text-white transition-all"
                >
                  Chennai Metro Rail (CMRL)
                </a>
              </li>
              <li className="flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 "></span>
                <a
                  href="https://sr.indianrailways.gov.in/"
                  target="_blank"
                  className="text-[15px] opacity-80 group-hover:opacity-100 group-hover:text-white text-white transition-all"
                >
                  Southern railways (SR)
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-2">Contact Info</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-3 items-start leading-relaxed opacity-90">
                <span>
                  Chennai Metropolitan Development Authority,
                  Thalamuthu-Natarajan Maaligai, No.1, Gandhi Irwin Road,Egmore,
                  Chennai – 600 008.
                </span>
              </li>
              <li className="flex gap-3 items-center opacity-90">
                044 - 24322377
                <br />
                044 - 28552355
              </li>
              <li className="flex gap-3 items-center opacity-90">
                <a
                  href="mailto:office@cumta.in"
                  className="hover:text-white text-white transition-colors"
                >
                  office@cumta.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-[18px] opacity-80 text-center font-bold">
          © 2026 Chennai Unified Metropolitan Transport Authority. All Rights
          Reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;

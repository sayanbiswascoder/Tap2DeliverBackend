"use client";
import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiGoogleanalytics } from "react-icons/si";
import { IoRestaurant } from "react-icons/io5";
import { MdDirectionsBike, MdFeedback } from "react-icons/md";
import { MdEditNote } from "react-icons/md";
import { RiSettings2Fill } from "react-icons/ri";
import { HiMiniRectangleStack } from "react-icons/hi2";

// Simple icons (replace with your preferred icon library if desired)
const icons = {
  dashboard: <SiGoogleanalytics />,
  restaurant: <IoRestaurant />,
  riders: <MdDirectionsBike />,
  orders: <MdEditNote size={24} />,
  banners: <HiMiniRectangleStack />,
  feedback: <MdFeedback  />,
  settings: <RiSettings2Fill />,
};

const sidebarRoutes = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: icons.dashboard,
  },
  {
    name: "Restaurants",
    path: "/dashboard/restaurants",
    icon: icons.restaurant,
  },
  {
    name: "Riders",
    path: "/dashboard/riders",
    icon: icons.riders,
  },
  {
    name: "Orders",
    path: "/dashboard/orders",
    icon: icons.orders,
  },
  {
    name: "Banners",
    path: "/dashboard/banners",
    icon: icons.banners
  },
  {
    name: "Feedback",
    path: "/dashboard/feedbacks",
    icon: icons.feedback
  },
  {
    name: "Settings",
    path: "/dashboard/settings",
    icon: icons.settings,
  },
];

const isPcOrTablet = () => {
  if (typeof window === "undefined") return true; // fallback for SSR
  // Consider tablet as >= 768px (Tailwind md:), PC as >= 1024px (lg:)
  return window.innerWidth >= 768;
};

const DashboardTemplate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // Persist sidebar state in sessionStorage so it doesn't reset on navigation
  const getInitialSidebarState = () => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("dashboardSidebarOpen");
      if (stored !== null) {
        return stored === "true";
      }
      // If not stored, set open for pc/tablet, closed for mobile
      return isPcOrTablet();
    }
    // SSR fallback: open
    return true;
  };

  const [sideBarOpen, setSideBarOpen] = useState(getInitialSidebarState);
  const [isMobileScreen, setIsMobileScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  // Listen for window resize to auto-close sidebar on mobile/tablet/pc switch (optional)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        // Only auto-close if not already stored in sessionStorage
        const stored = window.sessionStorage.getItem("dashboardSidebarOpen");
        if (stored === null) {
          setSideBarOpen(isPcOrTablet());
        }
        setIsMobileScreen(window.innerWidth < 768);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Save sidebar state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("dashboardSidebarOpen", String(sideBarOpen));
    }
  }, [sideBarOpen]);

  // On mount, update sidebar state if sessionStorage changes (e.g. on navigation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("dashboardSidebarOpen");
      if (stored !== null) {
        setSideBarOpen(stored === "true");
      } else {
        setSideBarOpen(isPcOrTablet());
      }
      setIsMobileScreen(window.innerWidth < 768);
    }
  }, [pathname]);

  const toggleSideBar = useCallback(() => {
    setSideBarOpen((prev) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("dashboardSidebarOpen", String(!prev));
      }
      return !prev;
    });
  }, []);

  // Compute section style based on screen size
  const sectionStyle: React.CSSProperties = isMobileScreen
    ? { marginLeft: 64, marginTop: 40, width: 'calc(100vw - 64px)' }
    : {
        width: sideBarOpen ? 'calc(100vw - 220px)' : 'calc(100vw - 64px)',
        marginLeft: sideBarOpen ? "220px" : "64px",
        marginTop: 40,
      };

  return (
    <>
      <nav className="w-screen bg-amber-400 h-12 flex items-center px-4 fixed top-0">
        <Image src="/logofull.png" alt="Tap2Deliver" width={160} height={100} />
      </nav>
      <div className="w-5 h-5 bg-amber-400 fixed top-12 duration-300" style={{
        marginLeft: sideBarOpen ? "220px" : "64px"
      }}>
        <div className="w-5 h-5 rounded-tl-full bg-gray-50" />
      </div>
      <main className="flex bg-gray-50">
        <aside
          className={`bg-amber-400 h-screen duration-300 flex flex-col items-center py-4 shadow-lg fixed top-12`}
          style={{ width: sideBarOpen ? "220px" : "64px", minWidth: sideBarOpen ? "220px" : "64px" }}
        >
          {/* Sidebar Toggle Button */}
          <button
            className="absolute -right-4 top-4 z-10 bg-white border border-amber-400 rounded-full shadow-lg p-2 transition hover:bg-amber-300 hover:scale-110 focus:outline-none"
            type="button"
            onClick={toggleSideBar}
            aria-label={sideBarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="block transition-transform duration-300">
              {sideBarOpen ? (
                // Left chevron
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                // Right chevron
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          </button>
          <nav className="flex flex-col gap-2 mt-12 w-full">
            {sidebarRoutes.map((route) => {
              const isActive =
                pathname === route.path ||
                (route.path !== "/dashboard" &&
                  pathname.startsWith(route.path));
              return (
                <Link
                  key={route.path}
                  href={route.path}
                  className={`flex items-center duration-300 gap-2 px-4 py-3 rounded-lg mx-2 transition-all font-medium h-12
                    ${
                      isActive
                        ? "bg-white text-amber-600 shadow font-bold"
                        : "text-amber-900 hover:bg-amber-300"
                    }
                    ${sideBarOpen ? "" : "justify-center"}
                  `}
                  style={{
                    minWidth: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {route.icon}
                  {sideBarOpen && <span className="delay-200">{route.name}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section
          className="flex-1 bg-gray-50 p-6 rounded-tl-xl overflow-y-auto overflow-x-scroll"
          style={sectionStyle}
        >
          {children}
        </section>
      </main>
    </>
  );
};

export default DashboardTemplate;

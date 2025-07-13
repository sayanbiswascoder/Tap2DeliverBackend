"use client"
import React from "react";

const Loading = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 animate-pulse flex items-center justify-center shadow-lg">
            <svg
              className="w-16 h-16 text-white animate-spin-slow"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 48 48"
            >
              <circle
                className="opacity-30"
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="6"
              />
              <path
                d="M44 24c0-11.046-8.954-20-20-20"
                stroke="#f59e42"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-amber-500 font-semibold text-lg tracking-wide">
            Loading Dashboard...
          </span>
        </div>
        <div className="text-center text-amber-700 text-lg font-medium mt-2">
          Please wait while we prepare your admin dashboard.
        </div>
        <div className="mt-6 flex gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
      <style jsx>{`
        .animate-spin-slow {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
      `}</style>
    </div>
  );
};

export default Loading;

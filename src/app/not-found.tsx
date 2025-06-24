import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200">
      <div className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center">
        <svg
          className="w-24 h-24 text-amber-400 mb-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 48 48"
        >
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="3" />
          <path
            d="M16 20c0-4 8-4 8 0m0 0c0-4 8-4 8 0m-8 8v2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="text-5xl font-bold text-amber-700 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-amber-800 mb-4">Page Not Found</h2>
        <p className="text-amber-500 mb-8 text-center max-w-md">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-amber-400 text-white rounded-lg shadow hover:bg-amber-500 transition-colors font-medium"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}

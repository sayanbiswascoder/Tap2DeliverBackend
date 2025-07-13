"use client";
import React, { useEffect, useState, ChangeEvent } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import Loading from "../loading";

interface Rider {
  id: string;
  name: string;
  phoneNumber?: string;
  vehicle?: string;
  [key: string]: unknown;
}

const RidersPage = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState<string>("");
  const [searchById, setSearchById] = useState<boolean>(false);

  useEffect(() => {
    const fetchRiders = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirestore();
        const querySnapshot = await getDocs(collection(db, "riders"));
        const data: Rider[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Rider);
        });
        setRiders(data);
      } catch {
        setError("Failed to load riders.");
      } finally {
        setLoading(false);
      }
    };

    fetchRiders();
  }, []);

  // Filter riders by name or id based on checkbox
  const filteredRiders = riders.filter((rider) => {
    if (searchValue.trim() === "") return true;
    if (searchById) {
      return rider.id.toLowerCase().includes(searchValue.trim().toLowerCase());
    } else {
      return (rider.name || "")
        .toLowerCase()
        .includes(searchValue.trim().toLowerCase());
    }
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-primary">Riders</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          <input
            type="text"
            placeholder={searchById ? "Search by ID" : "Search by name"}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearchValue(e.target.value)
            }
          />
          <label className="flex items-center gap-1 text-sm font-medium">
            <input
              type="checkbox"
              checked={searchById}
              onChange={() => setSearchById((prev) => !prev)}
              className="accent-primary"
            />
            Search by ID
          </label>
        </div>
      </div>
      {loading && <Loading />}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">Name</th>
                <th className="py-2 px-4 border-b text-left">Phone</th>
                <th className="py-2 px-4 border-b text-left">Vehicle</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No riders found.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-amber-50">
                    <td className="py-2 px-4 border-b">{rider.name || "N/A"}</td>
                    <td className="py-2 px-4 border-b">{rider.phoneNumber || "N/A"}</td>
                    <td className="py-2 px-4 border-b">{rider.vehicle || "N/A"}</td>
                    <td className="py-2 px-4 border-b">
                      <Link
                        href={`/dashboard/riders/${rider.id}`}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RidersPage;

"use client";
import React, { useEffect, useState, ChangeEvent } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import Link from "next/link";

interface Restaurant {
  id: string;
  name: string;
  address: unknown;
  cuisine: string;
  [key: string]: unknown;
}

const RestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState<string>("");
  const [searchById, setSearchById] = useState<boolean>(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirestore();
        const querySnapshot = await getDocs(collection(db, "restaurants"));
        const data: Restaurant[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Restaurant);
        });
        setRestaurants(data);
      } catch {
        setError("Failed to load restaurants.");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filter restaurants by name or id based on checkbox
  const filteredRestaurants = restaurants.filter((restaurant) => {
    if (searchValue.trim() === "") return true;
    if (searchById) {
      return restaurant.id.toLowerCase().includes(searchValue.trim().toLowerCase());
    } else {
      return restaurant.name.toLowerCase().includes(searchValue.trim().toLowerCase());
    }
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-primary">Restaurants</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          <input
            type="text"
            placeholder={searchById ? "Search by ID" : "Search by name"}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
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
      {loading && <div>Loading restaurants...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">Name</th>
                <th className="py-2 px-4 border-b text-left">Address</th>
                <th className="py-2 px-4 border-b text-left">Cuisine</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No restaurants found.
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="hover:bg-amber-50">
                    <td className="py-2 px-4 border-b">{restaurant.name}</td>
                    <td className="py-2 px-4 border-b">
                      {typeof restaurant.address === "string"
                        ? restaurant.address
                        : restaurant.address?.address || ""}
                    </td>
                    <td className="py-2 px-4 border-b">{restaurant.cuisine}</td>
                    <td className="py-2 px-4 border-b">
                      <Link
                        href={`/dashboard/restaurants/${restaurant.id}`}
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

export default RestaurantsPage;

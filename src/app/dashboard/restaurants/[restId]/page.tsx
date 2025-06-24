/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { notFound } from "next/navigation";
import Loading from "../../loading";

type Restaurant = {
  id: string;
  name: string;
  address?: unknown;
  cuisine?: string;
  categories?: string[];
  [key: string]: unknown;
};

type Dish = {
  id: string;
  name: string;
  price?: number;
  description?: string;
  category?: string;
  [key: string]: unknown;
};

// Remove explicit Props type and accept props as 'any' to avoid Next.js PageProps constraint error
const RestaurantPage = (props: any) => {
  const { params } = props;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Dishes state
  const [showDishes, setShowDishes] = useState(false);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesError, setDishesError] = useState<string | null>(null);

  async function getRestaurant(restId: string): Promise<Restaurant | null> {
    const db = getFirestore();
    const docRef = doc(db, "restaurants", restId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Restaurant;
  }

  async function getDishesForRestaurant(restId: string): Promise<Dish[]> {
    const db = getFirestore();
    const dishesRef = collection(db, "dishes");
    const q = query(dishesRef, where("restaurantId", "==", restId));
    const snap = await getDocs(q);
    const dishes: Dish[] = [];
    snap.forEach((doc) => {
      dishes.push({ id: doc.id, ...doc.data() } as Dish);
    });
    return dishes;
  }

  useEffect(() => {
    const fetchRestaurant = async () => {
      setLoading(true);
      const data = await getRestaurant(params.restId);
      setRestaurant(data);
      setLoading(false);
      if (!data) {
        notFound();
      }
    };
    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.restId]);

  const handleShowDishes = async () => {
    if (dishes !== null) {
      setShowDishes((prev) => !prev);
      return;
    }
    setDishesLoading(true);
    setDishesError(null);
    try {
      const fetchedDishes = await getDishesForRestaurant(params.restId);
      setDishes(fetchedDishes);
      setShowDishes(true);
    } catch {
      setDishesError("Failed to load dishes.");
    } finally {
      setDishesLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!restaurant) {
    // Should not reach here, but fallback
    return <div className="text-center text-red-600 mt-8">Restaurant not found.</div>;
  }

  // Categorize dishes by their category
  const categorizedDishes: Record<string, Dish[]> = {};
  if (dishes && Array.isArray(restaurant.categories)) {
    // For each category, collect dishes
    restaurant.categories.forEach((cat) => {
      categorizedDishes[cat] = dishes.filter(
        (dish) => dish.category === cat
      );
    });
    // Also collect dishes with no or unknown category
    const uncategorized = dishes.filter(
      (dish) =>
        !dish.category ||
        !restaurant.categories?.includes(dish.category)
    );
    if (uncategorized.length > 0) {
      categorizedDishes["Uncategorized"] = uncategorized;
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
      <h1 className="text-2xl font-bold mb-4 text-primary">Restaurant Details</h1>
      <div className="mb-2">
        <span className="font-semibold">ID:</span> {restaurant.id}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Name:</span> {restaurant.name || "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Cuisine:</span> {restaurant.cuisine || "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Address:</span>{" "}
        {typeof restaurant.address === "string"
          ? restaurant.address
          : (typeof restaurant.address === "object" && restaurant.address && "address" in restaurant.address)
            ? (restaurant.address as { address?: string }).address
            : "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Categories:</span>{" "}
        {Array.isArray(restaurant.categories) && restaurant.categories.length > 0
          ? restaurant.categories.join(", ")
          : "N/A"}
      </div>
      <div className="mt-4">
        <h2 className="font-semibold mb-2">Raw Data:</h2>
        <pre className="bg-gray-100 rounded p-2 text-sm overflow-x-auto">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(restaurant).filter(([k]) => k !== "id")
            ),
            null,
            2
          )}
        </pre>
      </div>
      <div className="mt-6">
        <button
          className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 font-semibold transition"
          onClick={handleShowDishes}
          disabled={dishesLoading}
        >
          {showDishes ? "Hide Dishes" : "Show Dishes"}
        </button>
        {dishesLoading && (
          <div className="mt-2 text-amber-600">Loading dishes...</div>
        )}
        {dishesError && (
          <div className="mt-2 text-red-600">{dishesError}</div>
        )}
        {showDishes && dishes && (
          <div className="mt-4">
            <h2 className="font-semibold mb-2">Dishes</h2>
            {dishes.length === 0 ? (
              <div className="text-gray-500">No dishes found for this restaurant.</div>
            ) : (
              <div>
                {Object.keys(categorizedDishes).length === 0 ? (
                  <div className="text-gray-500">No categories found for this restaurant.</div>
                ) : (
                  Object.entries(categorizedDishes).map(([cat, catDishes]) => (
                    <div key={cat} className="mb-6">
                      <h3 className="text-lg font-bold mb-2 text-amber-700">{cat}</h3>
                      {catDishes.length === 0 ? (
                        <div className="text-gray-400 mb-2">No dishes in this category.</div>
                      ) : (
                        <table className="min-w-full bg-white rounded shadow mb-2">
                          <thead>
                            <tr>
                              <th className="py-2 px-4 border-b text-left">Name</th>
                              <th className="py-2 px-4 border-b text-left">Price</th>
                              <th className="py-2 px-4 border-b text-left">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catDishes.map((dish) => (
                              <tr key={dish.id} className="hover:bg-amber-50">
                                <td className="py-2 px-4 border-b">{dish.name || "N/A"}</td>
                                <td className="py-2 px-4 border-b">
                                  {dish.price !== undefined ? `$${dish.price}` : "N/A"}
                                </td>
                                <td className="py-2 px-4 border-b">{dish.description || "N/A"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantPage;

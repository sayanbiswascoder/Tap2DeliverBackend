/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { notFound, useRouter } from "next/navigation";
import Loading from "../../loading";

type Offer = {
  type: "percentage" | "flat";
  value: number;
};

type Restaurant = {
  id: string;
  name: string;
  address?: unknown;
  cuisine?: string;
  categories?: string[];
  offer?: {
    offer?: Offer; // Restaurant-wide offer
    category?: Record<string, Offer>; // Category-specific offers
  };
  dummyOffer?: number; // Add dummyOffer to type for local state
  bestSailor?: string; // Add bestSailor to type for local state
  [key: string]: unknown;
};

type Dish = {
  id: string;
  name: string;
  price?: number;
  description?: string;
  category?: string;
  offer?: Offer; // Dish-specific offer
  [key: string]: unknown;
};

type Earnings = {
  earnings: number;
  payout: number;
  lastPayout?: string;
  updatedAt?: any;
};

const RestaurantPage = (props: any) => {
  const db = getFirestore();
  const { params } = props;
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Dishes state
  const [showDishes, setShowDishes] = useState(false);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesError, setDishesError] = useState<string | null>(null);

  // Offer management state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [currentOfferTarget, setCurrentOfferTarget] = useState<
    "restaurant" | "category" | "dish" | null
  >(null);
  const [currentOfferTargetId, setCurrentOfferTargetId] = useState<string | null>(null);
  const [offerValue, setOfferValue] = useState<string>("");
  const [offerType, setOfferType] = useState<"percentage" | "flat">("percentage");
  const [isUpdatingOffer, setIsUpdatingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  // Dummy offer modal state
  const [showDummyOfferModal, setShowDummyOfferModal] = useState(false);
  const [dummyOfferValue, setDummyOfferValue] = useState<string>("");
  const [dummyOfferError, setDummyOfferError] = useState<string | null>(null);
  const [isUpdatingDummyOffer, setIsUpdatingDummyOffer] = useState(false);

  // Best Sailor state
  const [isSettingBestSailor, setIsSettingBestSailor] = useState<string | null>(null);
  const [bestSailorError, setBestSailorError] = useState<string | null>(null);

  // Earnings state
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  // Payout modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [isPayoutProcessing, setIsPayoutProcessing] = useState(false);

  async function getRestaurant(restId: string): Promise<Restaurant | null> {
    const docRef = doc(db, "restaurants", restId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Restaurant;
  }

  async function getDishesForRestaurant(restId: string): Promise<Dish[]> {
    const dishesRef = collection(db, "dishes");
    const q = query(dishesRef, where("restaurantId", "==", restId));
    const snap = await getDocs(q);
    const dishes: Dish[] = [];
    snap.forEach((doc) => {
      dishes.push({ id: doc.id, ...doc.data() } as Dish);
    });
    return dishes;
  }

  async function getEarningsForRestaurant(restId: string): Promise<Earnings | null> {
    try {
      const docRef = doc(db, "earnings", restId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return snap.data() as Earnings;
    } catch {
      return null;
    }
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
  }, [params.restId]);

  useEffect(() => {
    const fetchEarnings = async () => {
      setEarningsLoading(true);
      setEarningsError(null);
      try {
        const data = await getEarningsForRestaurant(params.restId);
        setEarnings(data);
      } catch {
        setEarningsError("Failed to load earnings data.");
      } finally {
        setEarningsLoading(false);
      }
    };
    fetchEarnings();
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

  const handleOpenOfferModal = (
    target: "restaurant" | "category" | "dish",
    targetId: string
  ) => {
    setCurrentOfferTarget(target);
    setCurrentOfferTargetId(targetId);
    setOfferError(null);

    let existingOffer: Offer | undefined;

    if (target === "restaurant" && restaurant?.offer?.offer) {
      existingOffer = restaurant.offer.offer;
    } else if (target === "category" && restaurant?.offer?.category?.[targetId]) {
      existingOffer = restaurant.offer.category[targetId];
    } else if (target === "dish" && dishes) {
      existingOffer = dishes.find((d) => d.id === targetId)?.offer;
    }

    if (existingOffer) {
      setOfferValue(existingOffer.value.toString());
      setOfferType(existingOffer.type);
    } else {
      setOfferValue("");
      setOfferType("percentage");
    }

    setShowOfferModal(true);
  };

  // Dummy Offer Modal open handler
  const handleOpenDummyOfferModal = () => {
    // Only allow for restaurant
    setDummyOfferError(null);
    setDummyOfferValue(
      restaurant && typeof restaurant.dummyOffer === "number"
        ? restaurant.dummyOffer.toString()
        : ""
    );
    setShowDummyOfferModal(true);
  };

  const handleCloseOfferModal = () => {
    setShowOfferModal(false);
    setCurrentOfferTarget(null);
    setCurrentOfferTargetId(null);
    setOfferValue("");
    setOfferType("percentage");
    setOfferError(null);
  };

  const handleCloseDummyOfferModal = () => {
    setShowDummyOfferModal(false);
    setDummyOfferValue("");
    setDummyOfferError(null);
  };

  const handleSetOffer = async () => {
    if (!currentOfferTarget || !currentOfferTargetId || !offerValue) {
      setOfferError("Please select an offer type and enter a value.");
      return;
    }

    const value = parseFloat(offerValue);
    if (isNaN(value) || value <= 0) {
      setOfferError("Please enter a valid positive number for the offer value.");
      return;
    }

    setIsUpdatingOffer(true);
    setOfferError(null);

    try {
      if (currentOfferTarget === "restaurant") {
        const restDocRef = doc(db, "restaurants", currentOfferTargetId);
        await updateDoc(restDocRef, {
          "offer.offer": { type: offerType, value: value },
        });
        setRestaurant((prev) =>
          prev
            ? {
                ...prev,
                offer: { ...prev.offer, offer: { type: offerType, value: value } },
              }
            : null
        );
      } else if (currentOfferTarget === "category") {
        const restDocRef = doc(db, "restaurants", params.restId);
        await updateDoc(restDocRef, {
          [`offer.category.${currentOfferTargetId}`]: { type: offerType, value: value },
        });
        setRestaurant((prev) => {
          if (!prev) return null;
          const newOffer = {
            ...prev.offer,
            category: {
              ...(prev.offer?.category || {}),
              [currentOfferTargetId]: { type: offerType, value: value },
            },
          };
          return { ...prev, offer: newOffer };
        });
      } else if (currentOfferTarget === "dish") {
        const dishDocRef = doc(db, "dishes", currentOfferTargetId);
        await updateDoc(dishDocRef, {
          offer: { type: offerType, value: value },
        });
        setDishes((prev) =>
          prev
            ? prev.map((dish) =>
                dish.id === currentOfferTargetId
                  ? { ...dish, offer: { type: offerType, value: value } }
                  : dish
              )
            : null
        );
      }
      handleCloseOfferModal();
    } catch (error) {
      console.error("Error setting offer:", error);
      setOfferError("Failed to set offer. Please try again.");
    } finally {
      setIsUpdatingOffer(false);
    }
  };

  // Dummy Offer set handler
  const handleSetDummyOffer = async () => {
    if (!dummyOfferValue) {
      setDummyOfferError("Please enter a value for the dummy offer.");
      return;
    }
    const value = parseFloat(dummyOfferValue);
    if (isNaN(value) || value <= 0) {
      setDummyOfferError("Please enter a valid positive number for the dummy offer value.");
      return;
    }
    setIsUpdatingDummyOffer(true);
    setDummyOfferError(null);
    try {
      const restDocRef = doc(db, "restaurants", params.restId);
      await updateDoc(restDocRef, {
        dummyOffer: value,
      });
      setRestaurant((prev) => (prev ? { ...prev, dummyOffer: value } : null));
      handleCloseDummyOfferModal();
    } catch (error) {
      console.error("Error setting dummy offer:", error);
      setDummyOfferError("Failed to set dummy offer. Please try again.");
    } finally {
      setIsUpdatingDummyOffer(false);
    }
  };

  // Dummy Offer remove handler
  const handleRemoveDummyOffer = async () => {
    setIsUpdatingDummyOffer(true);
    setDummyOfferError(null);
    try {
      const restDocRef = doc(db, "restaurants", params.restId);
      await updateDoc(restDocRef, {
        dummyOffer: deleteField(),
      });
      setRestaurant((prev) => {
        if (!prev) return null;
        const { ...rest } = prev;
        return { ...rest, dummyOffer: undefined };
      });
      handleCloseDummyOfferModal();
    } catch (error) {
      console.error("Error removing dummy offer:", error);
      setDummyOfferError("Failed to remove dummy offer. Please try again.");
    } finally {
      setIsUpdatingDummyOffer(false);
    }
  };

  const handleRemoveOffer = async () => {
    if (!currentOfferTarget || !currentOfferTargetId) {
      setOfferError("No target selected for offer removal.");
      return;
    }

    setIsUpdatingOffer(true);
    setOfferError(null);

    try {
      if (currentOfferTarget === "restaurant") {
        const restDocRef = doc(db, "restaurants", currentOfferTargetId);
        await updateDoc(restDocRef, {
          "offer.offer": deleteField(),
        });
        setRestaurant((prev) =>
          prev ? { ...prev, offer: { ...prev.offer, offer: undefined } } : null
        );
      } else if (currentOfferTarget === "category") {
        const restDocRef = doc(db, "restaurants", params.restId);
        await updateDoc(restDocRef, {
          [`offer.category.${currentOfferTargetId}`]: deleteField(),
        });
        setRestaurant((prev) => {
          if (!prev) return null;
          const newCategoryOffers = { ...(prev.offer?.category || {}) };
          delete newCategoryOffers[currentOfferTargetId];
          return { ...prev, offer: { ...prev.offer, category: newCategoryOffers } };
        });
      } else if (currentOfferTarget === "dish") {
        const dishDocRef = doc(db, "dishes", currentOfferTargetId);
        await updateDoc(dishDocRef, {
          offer: deleteField(),
        });
        setDishes((prev) =>
          prev
            ? prev.map((dish) =>
                dish.id === currentOfferTargetId ? { ...dish, offer: undefined } : dish
              )
            : null
        );
      }
      handleCloseOfferModal();
    } catch (error) {
      console.error("Error removing offer:", error);
      setOfferError("Failed to remove offer. Please try again.");
    } finally {
      setIsUpdatingOffer(false);
    }
  };

  // Handler for adding banner
  const handleAddBanner = () => {
    router.push(`/dashboard/banners?restaurantId=${params.restId}`);
  };

  // Handler for setting bestSailor
  const handleSetBestSailor = async (dishId: string) => {
    setIsSettingBestSailor(dishId);
    setBestSailorError(null);
    try {
      const restDocRef = doc(db, "restaurants", params.restId);
      await updateDoc(restDocRef, {
        bestSailor: dishId,
      });
      setRestaurant((prev) => (prev ? { ...prev, bestSailor: dishId } : null));
    } catch (error) {
      console.error("Error setting bestSailor:", error);
      setBestSailorError("Failed to set as bestSailor. Please try again.");
    } finally {
      setIsSettingBestSailor(null);
    }
  };

  // Payout handlers
  const handleOpenPayoutModal = () => {
    setPayoutAmount("");
    setPayoutError(null);
    setShowPayoutModal(true);
  };

  const handleClosePayoutModal = () => {
    setShowPayoutModal(false);
    setPayoutAmount("");
    setPayoutError(null);
  };

  const handlePayout = async () => {
    if (!earnings) {
      setPayoutError("Earnings data not loaded.");
      return;
    }
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayoutError("Please enter a valid positive payout amount.");
      return;
    }
    const remaining = (earnings.earnings || 0) - (earnings.payout || 0);
    if (amount > remaining) {
      setPayoutError("Payout amount exceeds remaining payout.");
      return;
    }
    setIsPayoutProcessing(true);
    setPayoutError(null);
    try {
      const earningsDocRef = doc(db, "earnings", params.restId);
      await updateDoc(earningsDocRef, {
        payout: (earnings.payout || 0) + amount,
        lastPayout: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      // Update local state
      setEarnings((prev) =>
        prev
          ? {
              ...prev,
              payout: (prev.payout || 0) + amount,
              lastPayout: new Date().toISOString(),
            }
          : null
      );
      handleClosePayoutModal();
    } catch {
      setPayoutError("Failed to process payout. Please try again.");
    } finally {
      setIsPayoutProcessing(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!restaurant) {
    return <div className="text-center text-red-600 mt-8">Restaurant not found.</div>;
  }

  // Categorize dishes by their category
  const categorizedDishes: Record<string, Dish[]> = {};
  if (dishes && Array.isArray(restaurant.categories)) {
    restaurant.categories.forEach((cat) => {
      categorizedDishes[cat] = dishes.filter((dish) => dish.category === cat);
    });
    const uncategorized = dishes.filter(
      (dish) => !dish.category || !restaurant.categories?.includes(dish.category)
    );
    if (uncategorized.length > 0) {
      categorizedDishes["Uncategorized"] = uncategorized;
    }
  }

  // Determine if an offer currently exists for the selected target in the modal
  const hasExistingOffer = (() => {
    if (!currentOfferTarget || !currentOfferTargetId) return false;
    if (currentOfferTarget === "restaurant" && restaurant?.offer?.offer) {
      return true;
    }
    if (
      currentOfferTarget === "category" &&
      restaurant?.offer?.category?.[currentOfferTargetId]
    ) {
      return true;
    }
    if (currentOfferTarget === "dish" && dishes) {
      return dishes.some((d) => d.id === currentOfferTargetId && d.offer);
    }
    return false;
  })();

  // Determine if dummyOffer exists
  const hasDummyOffer = typeof restaurant.dummyOffer === "number";

  // Earnings display helpers
  const earningsValue = earnings?.earnings || 0;
  const payoutValue = earnings?.payout || 0;
  const remainingPayout = earningsValue - payoutValue;

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
          : typeof restaurant.address === "object" &&
            restaurant.address &&
            "address" in restaurant.address
          ? (restaurant.address as { address?: string }).address
          : "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Categories:</span>{" "}
        {Array.isArray(restaurant.categories) && restaurant.categories.length > 0
          ? restaurant.categories.join(", ")
          : "N/A"}
      </div>

      {/* Earnings and Payout Section */}
      <div className="mt-4 border-t pt-4">
        <h2 className="font-semibold mb-2">Earnings & Payout</h2>
        {earningsLoading ? (
          <div className="text-gray-500">Loading earnings...</div>
        ) : earningsError ? (
          <div className="text-red-600">{earningsError}</div>
        ) : earnings ? (
          <div className="mb-2">
            <div>
              <span className="font-semibold">Total Earnings:</span>{" "}
              <span className="text-green-700 font-mono">₹{earningsValue.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-semibold">Total Payout:</span>{" "}
              <span className="text-blue-700 font-mono">₹{payoutValue.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-semibold">Remaining Payout:</span>{" "}
              <span className="text-amber-700 font-mono">₹{remainingPayout.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-semibold">Last Payout:</span>{" "}
              {earnings.lastPayout
                ? new Date(earnings.lastPayout).toLocaleString()
                : "N/A"}
            </div>
            <button
              className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm transition"
              onClick={handleOpenPayoutModal}
              disabled={remainingPayout <= 0}
              title={remainingPayout <= 0 ? "No payout available" : "Payout"}
            >
              Payout
            </button>
          </div>
        ) : (
          <div className="text-gray-500">No earnings data found.</div>
        )}
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">Payout to Restaurant</h2>
            <div className="mb-4">
              <label
                htmlFor="payoutAmount"
                className="block text-sm font-medium text-gray-700"
              >
                Payout Amount (₹):
              </label>
              <input
                type="number"
                id="payoutAmount"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder={`Max: ₹${remainingPayout.toFixed(2)}`}
                min="0"
                max={remainingPayout}
                step="0.01"
              />
            </div>
            {payoutError && (
              <div className="text-red-600 text-sm mb-4">{payoutError}</div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                onClick={handleClosePayoutModal}
                disabled={isPayoutProcessing}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                onClick={handlePayout}
                disabled={isPayoutProcessing}
              >
                {isPayoutProcessing ? "Processing..." : "Payout"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        <h2 className="font-semibold mb-2">Restaurant Offers:</h2>
        {restaurant.offer?.offer ? (
          <div className="bg-green-100 text-green-800 p-2 rounded mb-2 text-sm">
            Restaurant-wide offer: {restaurant.offer.offer.value}
            {restaurant.offer.offer.type === "percentage" ? "%" : " flat"} off
          </div>
        ) : (
          <div className="text-gray-500 mb-2 text-sm">
            No restaurant-wide offer set.
          </div>
        )}
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm transition"
          onClick={() => handleOpenOfferModal("restaurant", restaurant.id)}
        >
          Set Restaurant Offer
        </button>
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm transition ml-2"
          onClick={() => handleOpenDummyOfferModal()}
        >
          Set Restaurant Dummy Offer
        </button>
        {hasDummyOffer && (
          <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-2 text-sm mt-2">
            Dummy Offer: {restaurant.dummyOffer}%
          </div>
        )}
      </div>

      {/* Dummy Offer Modal */}
      {showDummyOfferModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">
              Set Dummy Offer for Restaurant
            </h2>
            <div className="mb-4">
              <label
                htmlFor="dummyOfferValue"
                className="block text-sm font-medium text-gray-700"
              >
                Dummy Offer Value (%):
              </label>
              <input
                type="number"
                id="dummyOfferValue"
                value={dummyOfferValue}
                onChange={(e) => setDummyOfferValue(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 10"
                min="0"
              />
            </div>
            {dummyOfferError && (
              <div className="text-red-600 text-sm mb-4">{dummyOfferError}</div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                onClick={handleCloseDummyOfferModal}
                disabled={isUpdatingDummyOffer}
              >
                Cancel
              </button>
              {hasDummyOffer && (
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  onClick={handleRemoveDummyOffer}
                  disabled={isUpdatingDummyOffer}
                >
                  {isUpdatingDummyOffer ? "Removing..." : "Remove Dummy Offer"}
                </button>
              )}
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                onClick={handleSetDummyOffer}
                disabled={isUpdatingDummyOffer}
              >
                {isUpdatingDummyOffer ? "Setting..." : "Set Dummy Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New button for adding banner */}
      <div className="mt-4 border-t pt-4">
        <h2 className="font-semibold mb-2">Banners:</h2>
        <button
          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm transition"
          onClick={handleAddBanner}
        >
          Add Banner
        </button>
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
        {dishesError && <div className="mt-2 text-red-600">{dishesError}</div>}
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
                    <div key={cat} className="mb-6 border-b pb-4 last:border-b-0">
                      <h3 className="text-lg font-bold mb-2 text-amber-700 flex items-center justify-between">
                        <span>{cat}</span>
                        <button
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm transition"
                          onClick={() => handleOpenOfferModal("category", cat)}
                        >
                          Set Category Offer
                        </button>
                      </h3>
                      {restaurant.offer?.category?.[cat] ? (
                        <div className="bg-green-100 text-green-800 p-2 rounded text-sm mb-2">
                          Category offer: {restaurant.offer.category[cat].value}
                          {restaurant.offer.category[cat].type === "percentage"
                            ? "%"
                            : " flat"}{" "}
                          off
                        </div>
                      ) : (
                        <div className="text-gray-500 mb-2 text-sm">
                          No offer set for this category.
                        </div>
                      )}
                      {catDishes.length === 0 ? (
                        <div className="text-gray-400 mb-2">No dishes in this category.</div>
                      ) : (
                        <table className="min-w-full bg-white rounded shadow mb-2">
                          <thead>
                            <tr>
                              <th className="py-2 px-4 border-b text-left">Name</th>
                              <th className="py-2 px-4 border-b text-left">Price</th>
                              <th className="py-2 px-4 border-b text-left">Description</th>
                              <th className="py-2 px-4 border-b text-left">Offer</th>
                              <th className="py-2 px-4 border-b text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catDishes.map((dish) => (
                              <tr
                                key={dish.id}
                                className="hover:bg-amber-50"
                                title={`Dish ID: ${dish.id}`}
                              >
                                <td className="py-2 px-4 border-b">
                                  {dish.name || "N/A"}
                                </td>
                                <td className="py-2 px-4 border-b">
                                  {dish.price !== undefined
                                    ? `₹${dish.price}`
                                    : "N/A"}
                                </td>
                                <td className="py-2 px-4 border-b">
                                  {dish.description || "N/A"}
                                </td>
                                <td className="py-2 px-4 border-b">
                                  {dish.offer ? (
                                    <span className="text-green-700">
                                      {dish.offer.value}
                                      {dish.offer.type === "percentage"
                                        ? "%"
                                        : " flat"}{" "}
                                      off
                                    </span>
                                  ) : (
                                    "N/A"
                                  )}
                                </td>
                                <td className="py-2 px-4 border-b flex flex-col gap-1">
                                  <button
                                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs transition"
                                    onClick={() =>
                                      handleOpenOfferModal("dish", dish.id)
                                    }
                                  >
                                    Set Offer
                                  </button>
                                  <button
                                    className={`px-2 py-1 rounded text-xs transition ${
                                      restaurant.bestSailor === dish.id
                                        ? "bg-green-600 text-white"
                                        : "bg-amber-500 text-white hover:bg-amber-600"
                                    }`}
                                    onClick={() => handleSetBestSailor(dish.id)}
                                    disabled={isSettingBestSailor === dish.id}
                                    title="Set as Best Sailor"
                                  >
                                    {isSettingBestSailor === dish.id
                                      ? "Setting..."
                                      : restaurant.bestSailor === dish.id
                                      ? "Best Sailor"
                                      : "Set as Best Sailor"}
                                  </button>
                                  {restaurant.bestSailor === dish.id && (
                                    <span className="text-green-700 text-xs font-semibold">
                                      Best Sailor
                                    </span>
                                  )}
                                  {bestSailorError &&
                                    isSettingBestSailor === dish.id && (
                                      <span className="text-red-600 text-xs">
                                        {bestSailorError}
                                      </span>
                                    )}
                                </td>
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

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">
              Set Offer for{" "}
              {currentOfferTarget === "restaurant"
                ? "Restaurant"
                : currentOfferTarget === "category"
                ? `Category: ${currentOfferTargetId}`
                : `Dish: ${
                    dishes?.find((d) => d.id === currentOfferTargetId)?.name ||
                    currentOfferTargetId
                  }`}
            </h2>
            <div className="mb-4">
              <label
                htmlFor="offerValue"
                className="block text-sm font-medium text-gray-700"
              >
                Offer Value:
              </label>
              <input
                type="number"
                id="offerValue"
                value={offerValue}
                onChange={(e) => setOfferValue(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 10 or 50"
                min="0"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="offerType"
                className="block text-sm font-medium text-gray-700"
              >
                Offer Type:
              </label>
              <select
                id="offerType"
                value={offerType}
                onChange={(e) =>
                  setOfferType(e.target.value as "percentage" | "flat")
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount ($)</option>
              </select>
            </div>
            {offerError && (
              <div className="text-red-600 text-sm mb-4">{offerError}</div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                onClick={handleCloseOfferModal}
                disabled={isUpdatingOffer}
              >
                Cancel
              </button>
              {hasExistingOffer && (
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  onClick={handleRemoveOffer}
                  disabled={isUpdatingOffer}
                >
                  {isUpdatingOffer ? "Removing..." : "Remove Offer"}
                </button>
              )}
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                onClick={handleSetOffer}
                disabled={isUpdatingOffer}
              >
                {isUpdatingOffer ? "Setting Offer..." : "Set Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantPage;

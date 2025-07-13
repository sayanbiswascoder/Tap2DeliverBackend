/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { notFound } from "next/navigation";
import Loading from "../../loading";

type Rider = {
  id: string;
  name?: string;
  phoneNumber?: string;
  vehicle?: string;
  [key: string]: unknown;
};

type RiderEarnings = {
  earnings: number;
  payout: number;
  lastPayout?: any; // could be Timestamp, Date, or string
  updatedAt?: any;
};

async function getRider(riderId: string): Promise<Rider | null> {
  const db = getFirestore();
  const docRef = doc(db, "riders", riderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Rider;
}

async function getRiderEarnings(riderId: string): Promise<RiderEarnings | null> {
  const db = getFirestore();
  const docRef = doc(db, "earnings", riderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as RiderEarnings;
}

const RiderPage = (props: any) => {
  const { params } = props;
  const [rider, setRider] = useState<Rider | null>(null);
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchRiderAndEarnings = async () => {
      setLoading(true);
      setPayoutError(null);
      setPayoutSuccess(null);
      const [riderData, earningsData] = await Promise.all([
        getRider(params.riderId),
        getRiderEarnings(params.riderId),
      ]);
      setRider(riderData);
      setEarnings(earningsData);
      setLoading(false);
      if (!riderData) {
        notFound();
      }
    };
    fetchRiderAndEarnings();
  }, [params.riderId]);

  // Helper to format date
  function formatDate(val: any) {
    if (!val) return "N/A";
    if (typeof val === "object" && "seconds" in val) {
      // Firestore Timestamp
      return new Date(val.seconds * 1000).toLocaleString();
    }
    if (typeof val === "string" || val instanceof Date) {
      return new Date(val).toLocaleString();
    }
    return String(val);
  }

  // Calculate remaining payout
  const totalEarnings = earnings?.earnings ?? 0;
  const totalPayout = earnings?.payout ?? 0;
  const remainingPayout = totalEarnings - totalPayout;

  // Handle payout
  const handlePayout = async () => {
    if (!earnings || remainingPayout <= 0) return;
    setPayoutLoading(true);
    setPayoutError(null);
    setPayoutSuccess(null);
    try {
      const db = getFirestore();
      const earningsRef = doc(db, "earnings", params.riderId);
      await updateDoc(earningsRef, {
        payout: totalEarnings,
        lastPayout: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEarnings({
        ...earnings,
        payout: totalEarnings,
        lastPayout: new Date(), // for immediate UI update
        updatedAt: new Date(),
      });
      setPayoutSuccess("Payout successful!");
    } catch {
      setPayoutError("Failed to process payout. Please try again.");
    }
    setPayoutLoading(false);
  };

  if (loading) {
    return <Loading />;
  }

  if (!rider) {
    // Should not reach here, but fallback
    return (
      <div className="text-center text-red-600 mt-8">Rider not found.</div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
      <h1 className="text-2xl font-bold mb-4 text-primary">Rider Details</h1>
      <div className="mb-2">
        <span className="font-semibold">ID:</span> {rider.id}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Name:</span> {rider.name || "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Phone:</span> {rider.phoneNumber || "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Vehicle:</span> {rider.vehicle || "N/A"}
      </div>

      <div className="mt-6 mb-4">
        <h2 className="font-semibold mb-2 text-lg text-amber-700">Earnings & Payout</h2>
        <div className="flex flex-col gap-1">
          <div>
            <span className="font-semibold">Total Earnings:</span>{" "}
            <span className="text-green-700 font-mono">
              ₹{totalEarnings.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="font-semibold">Total Payout:</span>{" "}
            <span className="text-blue-700 font-mono">
              ₹{totalPayout.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="font-semibold">Remaining Payout:</span>{" "}
            <span className="text-red-700 font-mono">
              ₹{remainingPayout.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="font-semibold">Last Payout Date:</span>{" "}
            {earnings?.lastPayout ? (
              <span className="font-mono">{formatDate(earnings.lastPayout)}</span>
            ) : (
              "N/A"
            )}
          </div>
          <div>
            <button
              className={`mt-2 px-4 py-2 rounded bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-60`}
              disabled={remainingPayout <= 0 || payoutLoading}
              onClick={handlePayout}
            >
              {payoutLoading
                ? "Processing..."
                : remainingPayout > 0
                ? `Pay ₹${remainingPayout.toLocaleString("en-IN")}`
                : "No payout due"}
            </button>
          </div>
          {payoutError && (
            <div className="text-red-600 mt-2">{payoutError}</div>
          )}
          {payoutSuccess && (
            <div className="text-green-600 mt-2">{payoutSuccess}</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h2 className="font-semibold mb-2">Other Data:</h2>
        <pre className="bg-gray-100 rounded p-2 text-sm overflow-x-auto">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(rider).filter(
                ([k]) => k !== "id" && k !== "name" && k !== "phone" && k !== "vehicle"
              )
            ),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
};

export default RiderPage;

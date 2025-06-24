"use client";
import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { notFound } from "next/navigation";
import Loading from "../../loading";

type Rider = {
  id: string;
  name?: string;
  phone?: string;
  vehicle?: string;
  [key: string]: unknown;
};

type Props = {
  params: { riderId: string };
};

async function getRider(riderId: string): Promise<Rider | null> {
  const db = getFirestore();
  const docRef = doc(db, "riders", riderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Rider;
}

const RiderPage = ({ params }: Props) => {
  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRider = async () => {
      setLoading(true);
      const data = await getRider(params.riderId);
      setRider(data);
      setLoading(false);
      if (!data) {
        notFound();
      }
    };
    fetchRider();
  }, [params.riderId]);

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
        <span className="font-semibold">Phone:</span> {rider.phone || "N/A"}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Vehicle:</span> {rider.vehicle || "N/A"}
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

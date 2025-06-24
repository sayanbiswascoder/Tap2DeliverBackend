/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { useEffect, useState } from "react";
import { app } from "@/app/lib/firebase";
import { getFirestore } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore"
import { notFound } from "next/navigation";
import Loading from "../../loading";

type Order = {
  id: string;
  createdAt?: { toDate?: () => Date };
  [key: string]: any;
};

// Remove explicit Props type and use the Next.js convention for PageProps
interface PageProps {
  params: { orderId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

const db = getFirestore(app);

async function getOrder(orderId: string): Promise<Order | null> {
  const docRef = doc(db, "orders", orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

const Page = ({ params }: PageProps) => {
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(()=> {
    const fetchOrder = async() => {
      const order = await getOrder(params.orderId);
      setOrder(order);
    
      if (!order) {
        notFound();
      }
    }
    fetchOrder()
  }, [params])

  if (!order) {
    return <Loading />
  }

  
  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
      <h1 className="text-2xl font-bold mb-4 text-primary">Order Details</h1>
      <div className="mb-2">
        <span className="font-semibold">Order ID:</span> {order.id}
      </div>
      <div className="mb-2">
        <span className="font-semibold">Created At:</span>{" "}
        {order.createdAt?.toDate
          ? order.createdAt.toDate().toLocaleString()
          : "N/A"}
      </div>
      <div className="mt-4">
        <h2 className="font-semibold mb-2">Order Data:</h2>
        <pre className="bg-gray-100 rounded p-2 text-sm overflow-x-auto">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(order).filter(
                ([k]) => k !== "id" && k !== "createdAt"
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

export default Page;
"use client"

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getFirestore, collection, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 10;
const db = getFirestore();

type Order = {
  id: string;
  createdAt?: { toDate?: () => Date };
  [key: string]: any;
};

const OrdersList = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Clear state on mount to prevent duplicate data when navigating back
  useEffect(() => {
    setOrders([]);
    setHasMore(true);
    setLastDoc(null);
    setLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    let q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    if (lastDoc) {
      q = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    }

    const snap = await getDocs(q);
    const newOrders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Prevent duplicate orders by checking IDs
    setOrders((prev) => {
      const existingIds = new Set(prev.map((order) => order.id));
      const filteredNewOrders = newOrders.filter((order) => !existingIds.has(order.id));
      return [...prev, ...filteredNewOrders];
    });

    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.size === PAGE_SIZE);
    setLoading(false);
  }, [lastDoc, loading, hasMore]);

  // Lazy load on scroll to bottom (Intersection Observer)
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          fetchOrders();
        }
      },
      { threshold: 1 }
    );
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [fetchOrders, loading, hasMore]);

  // Initial fetch
  useEffect(() => {
    if (orders.length === 0) fetchOrders();
    // eslint-disable-next-line
  }, [fetchOrders]);

  return (
    <div className="max-w-4xl mx-auto px-2">
      <h1 className="text-2xl font-bold mb-6 text-primary">Orders</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl shadow hover:shadow-lg transition cursor-pointer border border-gray-100 hover:border-amber-400 p-4 flex flex-col justify-between"
            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
            tabIndex={0}
            role="button"
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                router.push(`/orders/${order.id}`);
              }
            }}
            aria-label={`View order ${order.id}`}
          >
            <div className="mb-2">
              <span className="font-semibold">Order ID:</span> {order.id}
            </div>
            <div>
              <span className="text-gray-600 text-sm">
                {order.createdAt?.toDate
                  ? order.createdAt.toDate().toLocaleString()
                  : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
      {loading && (
        <div className="text-center text-gray-500 py-4">Loading...</div>
      )}
      {!hasMore && orders.length > 0 && (
        <div className="text-center text-gray-400 py-2">No more orders.</div>
      )}
      <div ref={loaderRef} style={{ height: 1 }} />
    </div>
  );
};

export default OrdersList;
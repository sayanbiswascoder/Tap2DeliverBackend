"use client";
import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, getFirestore } from "firebase/firestore";


type Feedback = {
    id: string;
    feedback: string;
    userId?: string;
    timestamp?: { seconds: number; nanoseconds: number } | Date | string;
    [key: string]: unknown;
};

const FeedbacksPage = () => {
    const db = getFirestore();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedbacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, "feedbacks"));
      const data: Feedback[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Feedback);
      });
      // Sort by createdAt descending if available
      data.sort((a, b) => {
        const aTime =
          typeof a.timestamp === "object" && a.timestamp && "seconds" in a.timestamp
            ? a.timestamp.seconds
            : 0;
        const bTime =
          typeof b.timestamp === "object" && b.timestamp && "seconds" in b.timestamp
            ? b.timestamp.seconds
            : 0;
        return bTime - aTime;
      });
      setFeedbacks(data);
    } catch {
      setError("Failed to fetch feedbacks.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
    // eslint-disable-next-line
  }, []);

  const handleResolve = async (id: string) => {
    setResolving(id);
    setError(null);
    try {
      await deleteDoc(doc(db, "feedbacks", id));
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError("Failed to resolve feedback.");
    }
    setResolving(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Feedbacks</h1>
      {error && (
        <div className="mb-4 text-red-600 bg-red-100 p-2 rounded">{error}</div>
      )}
      {loading ? (
        <div>Loading feedbacks...</div>
      ) : feedbacks.length === 0 ? (
        <div className="text-gray-500">No feedbacks found.</div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-white shadow rounded p-4 flex flex-col md:flex-row md:items-center justify-between"
            >
              <div>
                <div className="font-medium text-gray-800 mb-1">{fb.feedback}</div>
                {fb.userId && (
                  <div className="text-sm text-gray-500">User: {fb.userId}</div>
                )}
                {fb.timestamp && (
                  <div className="text-xs text-gray-400">
                    {(() => {
                      let date: Date | null = null;
                      if (
                        typeof fb.timestamp === "object" &&
                        fb.timestamp &&
                        "seconds" in fb.timestamp
                      ) {
                        date = new Date(fb.timestamp.seconds * 1000);
                      } else if (typeof fb.timestampt === "string") {
                        date = new Date(fb.timestamp);
                      } else if (fb.timestamp instanceof Date) {
                        date = fb.timestamp;
                      }
                      return date
                        ? `Submitted: ${date.toLocaleString()}`
                        : null;
                    })()}
                  </div>
                )}
              </div>
              <button
                className="mt-3 md:mt-0 md:ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                onClick={() => handleResolve(fb.id)}
                disabled={resolving === fb.id}
              >
                {resolving === fb.id ? "Resolving..." : "Resolve"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbacksPage;

"use client";
import React, { useEffect, useState, useRef } from "react";
import { getFirestore, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const db = getFirestore();

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(new Date(d));
  }
  return days;
}

const Page = () => {
  const [orderCounts, setOrderCounts] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Responsive chart container
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      const days = getLast7Days();
      const counts: number[] = [];
      const dayLabels: string[] = [];

      for (let i = 0; i < days.length; i++) {
        const start = days[i];
        const end = new Date(start);
        end.setDate(start.getDate() + 1);

        // Format label as e.g. "Mon", "Tue"
        dayLabels.push(start.toLocaleDateString(undefined, { weekday: "long" }));

        // Query orders where createdAt >= start && createdAt < end
        const q = query(
          collection(db, "orders"),
          where("status", "==", "DELIVERED"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<", Timestamp.fromDate(end))
        );
        const snap = await getDocs(q);
        counts.push(snap.size);
      }

      setOrderCounts(counts);
      setLabels(dayLabels);
      setLoading(false);
    }

    fetchOrders();
  }, []);

  const data = {
    labels,
    datasets: [
      {
        label: "Orders per Day",
        data: orderCounts,
        backgroundColor: "rgba(251, 191, 36, 0.7)", // amber-400
        borderColor: "rgba(251, 191, 36, 1)",
        borderWidth: 1,
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  return (
    <div className="bg-primary/5 rounded-xl p-4 sm:p-6 shadow w-full max-w-3xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-primary text-center sm:text-left">
        Orders in the Last 7 Days
      </h2>
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{
          minHeight: 220,
          height: "clamp(220px, 40vw, 400px)",
          maxHeight: 420,
        }}
      >
        {loading ? (
          <div className="text-gray-500 flex items-center justify-center h-full">Loading...</div>
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  );
};

export default Page;

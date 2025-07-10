/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState } from "react";
import { auth, db } from "../lib/firebase";

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";

const provider = new GoogleAuthProvider();

const AuthPage = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);

      // checking if the user is not a restaurant or rider
      const restaurantSnap = await getDoc(doc(db, "restaurants", result.user.uid));
      const riderSnap = await getDoc(doc(db, "riders", result.user.uid));

      if(restaurantSnap.exists() || riderSnap.exists()) {
        alert("You can't login in this app with a user or rider ID");
        signOut(auth)
        return;
      }
      
      router.replace("/")
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // checking if the user is not a restaurant or rider
      const restaurantSnap = await getDoc(doc(db, "restaurants", result.user.uid));
      const riderSnap = await getDoc(doc(db, "riders", result.user.uid));

      if(restaurantSnap.exists() || riderSnap.exists()) {
        alert("You can't login in this app with a user or rider ID");
        signOut(auth)
        return;
      }

      router.replace("/")
    } catch (err: any) {
      setError(err?.message || "Email/password sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-yellow-200">
      <div className="bg-white/90 rounded-xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-primary">Welcome Back!</h1>
        <p className="mb-6 text-gray-600 text-center">
          Sign in to your account to access your dashboard.
        </p>
        
            <form
              onSubmit={handleCredentialsSignIn}
              className="w-full flex flex-col gap-4 mb-6"
            >
              <input
                type="email"
                placeholder="Email"
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:text-white rounded-lg shadow hover:bg-yellow-600 transition font-semibold"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in with Email"}
              </button>
            </form>
            <div className="w-full flex items-center my-4">
              <div className="flex-grow h-px bg-gray-300" />
              <span className="mx-2 text-gray-400 text-sm">or</span>
              <div className="flex-grow h-px bg-gray-300" />
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 px-6 py-3 bg-primary rounded-lg shadow hover:bg-yellow-600 hover:text-white transition font-semibold text-lg w-full justify-center"
              disabled={loading}
            >
              <FcGoogle size={28} />
              {loading ? "Signing in..." : "Sign in with Google"}
            </button>
        {error && (
          <div className="mt-4 text-red-600 text-sm text-center">{error}</div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { getDoc, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaCheck } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const provider = new GoogleAuthProvider();

const AuthPage = () => {
  const { user } = useAuth()
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSignup, setIsSignup] = useState<boolean>(false);
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    if (isSignup && !acceptTerms) {
      setError("You must accept the Terms & Conditions to sign up.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // checking if the user is not a restaurant or rider
      const restaurantSnap = await getDoc(doc(db, "restaurants", user.uid));
      const riderSnap = await getDoc(doc(db, "riders", user.uid));

      if (restaurantSnap.exists() || riderSnap.exists()) {
        alert("You can't login in this app with a restaurant or rider ID");
        await signOut(auth);
        return;
      }

      // For signup, create user documents if they don't exist
      if (isSignup) {
        const docRef = doc(db, "users", user.uid);
        const cartDocRef = doc(db, "carts", user.uid);
        const favouritesDocRef = doc(db, "favourites", user.uid);
        const docSnap = await getDoc(docRef);
        const cartDocSnap = await getDoc(cartDocRef);
        const favouritesDocSnap = await getDoc(favouritesDocRef);

        if (!docSnap.exists() && !cartDocSnap.exists() && !favouritesDocSnap.exists()) {
          await setDoc(docRef, {
            name: user.displayName || "",
            email: user.email,
            dateOfBirth: new Date(0),
            anniversary: new Date(0),
            gender: "",
            addresses: [],
            createdAt: new Date(),
            fcmToken: null
          });
          await setDoc(cartDocRef, {
            foodCart: {},
            groceryCart: {}
          });
          await setDoc(favouritesDocRef, {
            favourites: [],
            bookmarks: [],
            ratings: {}
          });
        }
      }

      router.replace("/");
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

      if (restaurantSnap.exists() || riderSnap.exists()) {
        alert("You can't login in this app with a restaurant or rider ID");
        await signOut(auth);
        return;
      }

      router.replace("/");
    } catch (err: any) {
      setError(err?.message || "Email/password sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setError("You must accept the Terms & Conditions to sign up.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await createUserWithEmailAndPassword(auth, email, password);

      // checking if the user is not a restaurant or rider
      const restaurantSnap = await getDoc(doc(db, "restaurants", user.user.uid));
      const riderSnap = await getDoc(doc(db, "riders", user.user.uid));

      if (restaurantSnap.exists() || riderSnap.exists()) {
        alert("You can't signup in this app with a restaurant or rider ID");
        await signOut(auth);
        return;
      }

      const docRef = doc(db, "users", user.user.uid);
      const cartDocRef = doc(db, "carts", user.user.uid);
      const favouritesDocRef = doc(db, "favourites", user.user.uid);

      await setDoc(docRef, {
        email: user.user.email,
        name: "",
        dateOfBirth: new Date(0),
        anniversary: new Date(0),
        gender: "",
        addresses: [],
        createdAt: new Date(),
        fcmToken: null
      });
      await setDoc(cartDocRef, {
        foodCart: {},
        groceryCart: {}
      });
      await setDoc(favouritesDocRef, {
        favourites: [],
        bookmarks: [],
        ratings: {}
      });

      router.replace("/");
    } catch (err: any) {
      setError(err?.message || "Email sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=> {
    if(user) {
      router.replace("/")
    }
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-yellow-200">
      <div className="bg-white/90 rounded-xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-primary">
          {isSignup ? "Sign Up" : "Welcome Back!"}
        </h1>
        <p className="mb-6 text-gray-600 text-center">
          {isSignup ? "Create a new account to get started." : "Sign in to your account to access your dashboard."}
        </p>
        
        <form
          onSubmit={isSignup ? handleCredentialsSignUp : handleCredentialsSignIn}
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
          {isSignup && (
            <>
              <input
                type="password"
                placeholder="Confirm Password"
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAcceptTerms(!acceptTerms)}
                  className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                    acceptTerms ? "bg-primary border-primary" : "border-gray-300"
                  }`}
                >
                  {acceptTerms && <FaCheck className="text-white text-sm" />}
                </button>
                <p className="text-sm text-gray-600">
                  I accept the{" "}
                  <a
                    href="/terms-and-conditions"
                    className="text-primary underline hover:text-yellow-600"
                  >
                    Terms & Conditions
                  </a>
                </p>
              </div>
            </>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-primary hover:text-white rounded-lg shadow hover:bg-yellow-600 transition font-semibold"
            disabled={loading || (isSignup && !acceptTerms)}
          >
            {loading ? "Processing..." : isSignup ? "Sign Up" : "Sign In"}
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
          disabled={loading || (isSignup && !acceptTerms)}
        >
          <FcGoogle size={28} />
          {loading ? "Processing..." : isSignup ? "Sign Up with Google" : "Sign In with Google"}
        </button>
        <button
          onClick={() => {
            setIsSignup(!isSignup);
            setAcceptTerms(false);
            setError(null);
          }}
          className="mt-4 text-primary hover:text-yellow-600 font-semibold"
        >
          {isSignup ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
        </button>
        {error && (
          <div className="mt-4 text-red-600 text-sm text-center">{error}</div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;

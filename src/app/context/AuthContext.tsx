// context/AuthContext.tsx (or .js)
'use client';

import { createContext, useContext, useEffect, useState } from 'react'; // ReactNode usually not needed here
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Cookies from "js-cookie";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// Provide a default value that matches the interface
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true, // Default to true, as we'll be loading state
});

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => { // Use React.ReactNode
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async(currentUser) => {
      setUser(currentUser);
      const idToken = await currentUser?.getIdToken(); // Get the ID token
      Cookies.set("firebase_id_token", idToken || "", { expires: 1, secure: true }); // Store for 1 day, secure in production
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  return (
    <AuthContext.Provider value={{ user, loading }}>
      { children }
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  // With the default value, 'context' will never be null here,
  // so the null check is technically not strictly necessary anymore for type safety
  // if you trust that the provider will always wrap consumers.
  // However, keeping it can still be a good defensive practice if the provider isn't guaranteed.
  // For most React/Next.js apps, this check becomes less about type safety
  // and more about providing a helpful runtime error if someone misuses the hook.
  return context;
};
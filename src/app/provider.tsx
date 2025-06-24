// app/providers.jsx
'use client';

import { AuthProvider } from './context/AuthContext'; // Adjust path

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
"use client"
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const auth = getAuth()
  const router = useRouter()

  const handleLogOut = () => {
    signOut(auth)
    router.replace("/auth")
  }
  
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h1>Hello World</h1>
      <button onClick={handleLogOut}>Log Out</button>
    </div>
  );
}

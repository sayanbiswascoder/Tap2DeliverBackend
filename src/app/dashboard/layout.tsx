"use server";
import { cookies } from "next/headers";
import { auth } from "@lib/firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import NotFound from "../not-found";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    let isAdmin = false;
    try{
        const db = getFirestore();
        // Get the 'userToken' cookie
        const cookieStore = cookies();
        const userToken = (await cookieStore).get("firebase_id_token")?.value;
        const user = await auth.verifyIdToken(userToken || "");
      
        const adminDocRef = db.collection("admins").doc(user.uid);
        const adminDocSnap = await adminDocRef.get();
        isAdmin = adminDocSnap.exists;
    } catch (error) {
        console.error(error)
    }

  // For demonstration, just render the cookie value (or a message if not found)
  return isAdmin ? (
    <div className="max-h-screen">{children}</div>
  ) : <NotFound />
}

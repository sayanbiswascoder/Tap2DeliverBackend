import { db } from "./firebaseAdmin";

const getPriceNAvailabilityOfDish = async(dishId) => {
  const dishRef = db.collection('dishes').doc(dishId);
  const dishDoc = await dishRef.get();
  if (!dishDoc.exists) {
    throw new Error('Dish not found');
  }
  const dishData = dishDoc.data();
  return {
    price: Number(dishData?.price),
    isAvailable: Boolean(dishData?.available)
  };
}

export default getPriceNAvailabilityOfDish;

import { NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';
import { DocumentReference } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';
import { distanceBetween } from 'geofire-common';

// Define Offer type based on context files (e.g., from dashboard/restaurants/[restId]/page.tsx)
interface Offer {
    type: 'percentage' | 'flat';
    value: number;
}

// Helper function to apply an offer to a base price
function applyOffer(basePrice: number, offer?: Offer): number {
    if (!offer) return basePrice;

    if (offer.type === 'percentage') {
        return basePrice * (1 - offer.value / 100);
    } else if (offer.type === 'flat') {
        // Ensure the price does not go below zero after applying a flat discount
        return Math.max(0, basePrice - offer.value); 
    }
    return basePrice;
}

// Constants for order calculations (these could be fetched from a global configuration
// or restaurant-specific settings in a more complex application)
const GST_PERCENTAGE = 5; // Example 5% GST
const PLATFORM_FEE = 10; // Example 10 rupees platform fee

// Updated interfaces for the incoming request body to reflect server-side calculation
interface RequestOrderItem {
    id: string; // Dish ID
    qty: number; // Quantity of the dish
}

interface RequestOrderGroup {
    restaurantId: string; // Mandatory: Each order group must belong to a restaurant
    items: RequestOrderItem[]; // List of dishes in this order group
}

// New interface for user address with coordinates
interface UserAddress {
    coords: [latitute: number, logitute: number]
    // Allow other properties for flexibility, but ensure lat/lng are present
    [key: string]: unknown; 
}

// New interfaces for processed order data to replace 'any' types
interface ProcessedOrderItem {
    id: string;
    qty: number;
    name: string;
    basePrice: number;
    finalPricePerUnit: number;
    appliedOffer?: Offer & { source: string };
}

interface ProcessedOrderGroup {
    restaurantId: string;
    items: ProcessedOrderItem[];
    itemTotal: number;
    delivery: number;
    gst: number;
    platformFee: number; // Added platform fee
    total: number;
}

export async function POST(request: NextRequest) {
  try {
    // Destructure the request body, expecting an array of order groups
    const { userId, orderItems, address } = await request.json() as { 
        userId: string, 
        orderItems: RequestOrderGroup[], 
        address: UserAddress 
    };
    const orderGroups = orderItems;
    
    // Validate top-level request body parameters
    if (!userId || !orderGroups || !Array.isArray(orderGroups) || orderGroups.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body: userId, orderGroups (array), and address are required' },
        { status: 400 }
      );
    }
    // Validate address for coordinates, which are now required for delivery calculation
    if (!address || typeof address !== 'object' || Object.keys(address).length === 0 || typeof address.coords[0] !== 'number' || typeof address.coords[1] !== 'number') {
        return NextResponse.json(
            { error: 'Invalid request body: address is required and must be a non-empty object with latitude and longitude' },
            { status: 400 }
        );
    }

    const processedOrderGroups: ProcessedOrderGroup[] = []; // To store validated and calculated order details for each group
    const restaurantIds = new Set<string>(); // To collect unique restaurant IDs for sending notifications
    const orderRefs: DocumentReference[] = []; // To pre-generate Firestore document references for atomicity

    // First pass: Validate all items, calculate prices with offers, and prepare data for order creation
    for (const orderGroup of orderGroups) {
        // Validate individual order group structure
        if (!orderGroup.restaurantId || !orderGroup.items || !Array.isArray(orderGroup.items) || orderGroup.items.length === 0) {
            return NextResponse.json(
                { error: 'Invalid order group structure: restaurantId and items (array) are required for each group' },
                { status: 400 }
            );
        }

        // Fetch restaurant data to get restaurant-wide and category-specific offers, and location
        const restaurantDocRef = db.collection('restaurants').doc(orderGroup.restaurantId);
        const restaurantDoc = await restaurantDocRef.get();

        if (!restaurantDoc.exists) {
            return NextResponse.json(
                { error: `Restaurant with ID ${orderGroup.restaurantId} not found` },
                { status: 404 }
            );
        }
        const restaurantData = restaurantDoc.data() as { 
            offer?: { offer?: Offer; category?: Record<string, Offer> };
            address?: {
                location?: {
                    latitude: number;
                    longitude: number;
                };
            };
        };

        console.log(restaurantData)

        // Validate restaurant coordinates for delivery calculation
        if (typeof restaurantData.address?.location?.latitude !== 'number' || typeof restaurantData.address.location.longitude !== 'number') {
            return NextResponse.json(
                { error: `Restaurant with ID ${orderGroup.restaurantId} has invalid or missing location data.` },
                { status: 400 }
            );
        }

        const restaurantOffer = restaurantData?.offer?.offer;
        const categoryOffers = restaurantData?.offer?.category || {};

        let groupItemTotal = 0;
        const processedItems: ProcessedOrderItem[] = []; // To store detailed item info for the order record

        // Process each item in the current order group
        for (const item of orderGroup.items) {
            if (!item.id || typeof item.qty !== 'number' || item.qty <= 0) {
                return NextResponse.json(
                    { error: `Invalid item structure or quantity for item ID: ${item.id}` },
                    { status: 400 }
                );
            }

            // Fetch dish data to get base price, availability, category, and dish-specific offer
            const dishDocRef = db.collection('dishes').doc(item.id);
            const dishDoc = await dishDocRef.get();

            if (!dishDoc.exists) {
                return NextResponse.json(
                    { error: `Dish with ID ${item.id} not found` },
                    { status: 404 }
                );
            }
            const dishData = dishDoc.data() as { price?: number; available?: boolean; category?: string; offer?: Offer; name?: string };

            // Validate dish availability
            if (!dishData.available) {
                return NextResponse.json(
                    { 
                        error: "Some dishes are not available", 
                        unavailableItem: item.id 
                    },
                    { status: 400 }
                );
            }
            // Validate dish price and name
            if (typeof dishData.price !== 'number' || dishData.price <= 0) {
                return NextResponse.json(
                    { error: `Invalid or missing price for dish ${item.id}` },
                    { status: 400 }
                );
            }
            if (!dishData.name) {
                return NextResponse.json(
                    { error: `Missing name for dish ${item.id}` },
                    { status: 400 }
                );
            }

            let effectivePricePerUnit = dishData.price;
            let appliedOffer: Offer | undefined;
            let offerSource: string | undefined;

            // Apply offers based on a defined hierarchy: Dish-specific > Category-specific > Restaurant-wide
            if (dishData.offer) {
                effectivePricePerUnit = applyOffer(effectivePricePerUnit, dishData.offer);
                appliedOffer = dishData.offer;
                offerSource = 'dish';
            } 
            else if (dishData.category && categoryOffers[dishData.category]) {
                effectivePricePerUnit = applyOffer(effectivePricePerUnit, categoryOffers[dishData.category]);
                appliedOffer = categoryOffers[dishData.category];
                offerSource = 'category';
            } 
            else if (restaurantOffer) {
                effectivePricePerUnit = applyOffer(effectivePricePerUnit, restaurantOffer);
                appliedOffer = restaurantOffer;
                offerSource = 'restaurant';
            }

            // Accumulate total for the current order group based on calculated prices
            groupItemTotal += effectivePricePerUnit * item.qty;
            
            // Store detailed item information for the order record, including applied offers
            processedItems.push({
                id: item.id,
                qty: item.qty,
                name: dishData.name, // Store dish name for historical accuracy
                basePrice: dishData.price,
                finalPricePerUnit: effectivePricePerUnit,
                appliedOffer: appliedOffer ? { ...appliedOffer, source: offerSource } as Offer & { source: string } : undefined, // Include applied offer details and its source
            });
        }

        // Calculate delivery charge based on distance between user and restaurant
        const userLat = address.coords[0];
        const userLng = address.coords[1];
        const restaurantLat = restaurantData.address.location.latitude!; 
        const restaurantLng = restaurantData.address.location.longitude!;

        const distanceKm = distanceBetween([userLat, userLng], [restaurantLat, restaurantLng]) * 1.3;
        // Calculate delivery charge: distance in km * 10, with a minimum charge of 10
        const groupDelivery = Math.round(Math.max(10, distanceKm * 10)); 

        // Calculate GST and total for the current order group on the server-side
        const groupGst = groupItemTotal * (GST_PERCENTAGE / 100);
        // Add platform fee to the total
        const groupTotal = Math.round(groupItemTotal + groupDelivery + groupGst + PLATFORM_FEE);

        // Store all calculated details for this order group
        processedOrderGroups.push({
            restaurantId: orderGroup.restaurantId,
            items: processedItems,
            itemTotal: groupItemTotal,
            delivery: groupDelivery,
            gst: groupGst,
            platformFee: PLATFORM_FEE, // Store the platform fee
            total: groupTotal,
        });
        
        // Add restaurant ID to the set for notification purposes
        restaurantIds.add(orderGroup.restaurantId);
        // Pre-generate a document reference for the order to be used in the next pass
        orderRefs.push(db.collection("orders").doc());
    }

    try {
        // Second pass: Create orders in Firestore using the validated and calculated data
        for (let i = 0; i < processedOrderGroups.length; i++) {
            const processedGroup = processedOrderGroups[i];
            
            const orderData = {
                userId: userId,
                restaurantId: processedGroup.restaurantId,
                items: processedGroup.items, // These now include calculated prices and offer details
                itemTotal: processedGroup.itemTotal,
                status: "PLACED", // Initial status of the order
                paymentMode: "COD", // Assuming Cash on Delivery for now; could be dynamic
                paymentState: "PENDING", // Initial payment state
                delivery: processedGroup.delivery,
                gst: processedGroup.gst,
                platformFee: processedGroup.platformFee, // Include platform fee in order data
                total: processedGroup.total,
                address, // User's provided address
                createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp for creation
                updatedAt: admin.firestore.FieldValue.serverTimestamp()  // Use server timestamp for last update
            };
            await orderRefs[i].set(orderData);
        }

        // Send notifications to relevant restaurants whose orders were placed
        try {
            const fcmTokens: string[] = [];
            for (const restaurantId of restaurantIds) {
                const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
                const restaurantData = restaurantDoc.data(); 
                if (restaurantData?.fcmToken) {
                    fcmTokens.push(restaurantData.fcmToken);
                }
            }

            if (fcmTokens.length > 0) {
                const message: admin.messaging.MulticastMessage = {
                    tokens: fcmTokens,
                    notification: {
                        title: "New Order Received",
                        body: `You have received a new order.`,
                    },
                    "android": {
                        "notification": {
                            "channelId": "order",     // must match your Expo-defined channel
                            "sound": "custom_sound.wav" // the sound file without path
                        }
                    },
                    data: {
                        type: 'NEW_ORDER',
                        timestamp: new Date().toISOString() // Use current time for data payload
                    },
                };

                const response = await admin.messaging().sendEachForMulticast(message);
                if (response.failureCount > 0) {
                    console.error('Failed to send some messages:', response.responses);
                }
            }

            // Order is successfully placed even if notifications fail, so return success
            return NextResponse.json({ state: "SUCCESS" });
        } catch (error) {
            console.error('Error sending notifications:', error);
            // Log the error but still return success as the core order placement was successful
            return NextResponse.json({ state: "SUCCESS", message: "Order placed, but notification failed." });
        }
    } catch (error) {
        console.error('Error creating orders:', error);
        return NextResponse.json(
            { 
                error: "Failed to create orders", 
                state: "FAILED"
            },
            { status: 500 }
        );
    }
  } catch (error) {
    console.error('Error processing order:', error);
    return NextResponse.json(
        { 
            error: "Internal server error!", 
            state: "FAILED"
        },
        { status: 500 }
    );
  }
}

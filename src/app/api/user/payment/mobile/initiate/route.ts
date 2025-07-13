import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import axios from 'axios';
import admin, { db } from "@lib/firebaseAdmin"
import getAccessToken from '@lib/getAccessToken';
import { DocumentReference } from 'firebase-admin/firestore';
import { distanceBetween } from 'geofire-common';

// Define Offer type based on context files (e.g., from dashboard/restaurants/[restId]/page.tsx)
interface Offer {
    type: 'percentage' | 'flat';
    value: number;
}

// Define OpeningHours type based on file_context_0
interface DayOpeningHours {
    openTime: string;
    closeTime: string;
    isOpen: boolean;
}

interface OpeningHours {
    monday: DayOpeningHours;
    tuesday: DayOpeningHours;
    wednesday: DayOpeningHours;
    thursday: DayOpeningHours;
    friday: DayOpeningHours;
    saturday: DayOpeningHours;
    sunday: DayOpeningHours;
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
    // Remove optional from appliedOffer, but we will only include it if it exists (see below)
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
        const { userId, orderItems, address } = await request.json() as { userId: string, orderItems: RequestOrderGroup[], address: UserAddress };
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
                openingHours?: OpeningHours; // Added openingHours to restaurantData
            };

            // Validate restaurant coordinates for delivery calculation
            if (typeof restaurantData.address?.location?.latitude !== 'number' || typeof restaurantData.address?.location?.longitude !== 'number') {
                return NextResponse.json(
                    { error: `Restaurant with ID ${orderGroup.restaurantId} has invalid or missing location data.` },
                    { status: 400 }
                );
            }

            // Check if restaurant is open
            const now = new Date();
            const dayOfWeek = now.toLocaleString('en-us', { weekday: 'long' }).toLowerCase() as keyof OpeningHours;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const restaurantOpeningHours = restaurantData.openingHours?.[dayOfWeek];

            // Validate that opening hours for the current day are available and the restaurant is marked as open
            if (!restaurantOpeningHours || !restaurantOpeningHours.isOpen) {
                return NextResponse.json(
                    { error: `Restaurant ${orderGroup.restaurantId} is currently closed.` },
                    { status: 400 }
                );
            }

            // Validate openTime and closeTime existence and format
            if (!restaurantOpeningHours.openTime || !restaurantOpeningHours.closeTime) {
                return NextResponse.json(
                    { error: `Restaurant ${orderGroup.restaurantId} has incomplete opening hours configuration for today.` },
                    { status: 400 }
                );
            }

            const openTimeParts = restaurantOpeningHours.openTime.split(':').map(Number);
            const closeTimeParts = restaurantOpeningHours.closeTime.split(':').map(Number);

            // Validate that time parts are valid numbers and there are exactly two parts (hour and minute)
            if (openTimeParts.length !== 2 || closeTimeParts.length !== 2 ||
                isNaN(openTimeParts[0]) || isNaN(openTimeParts[1]) ||
                isNaN(closeTimeParts[0]) || isNaN(closeTimeParts[1])) {
                return NextResponse.json(
                    { error: `Restaurant ${orderGroup.restaurantId} has malformed opening hours configuration (e.g., time format not HH:MM).` },
                    { status: 400 }
                );
            }

            const [openHour, openMinute] = openTimeParts;
            const openMinutes = openHour * 60 + openMinute;

            const [closeHour, closeMinute] = closeTimeParts;
            const closeMinutes = closeHour * 60 + closeMinute;

            // Further validate time ranges (e.g., hours 0-23, minutes 0-59)
            if (openHour < 0 || openHour > 23 || openMinute < 0 || openMinute > 59 ||
                closeHour < 0 || closeHour > 23 || closeMinute < 0 || closeMinute > 59) {
                return NextResponse.json(
                    { error: `Restaurant ${orderGroup.restaurantId} has invalid time values in its opening hours configuration.` },
                    { status: 400 }
                );
            }

            // Handle cases where closing time is past midnight (e.g., 22:00 - 02:00)
            let isOpenNow = false;
            if (closeMinutes < openMinutes) { // Closing time is on the next day
                if (currentMinutes >= openMinutes || currentMinutes <= closeMinutes) {
                    isOpenNow = true;
                }
            } else { // Closing time is on the same day
                if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
                    isOpenNow = true;
                }
            }

            if (!isOpenNow) {
                return NextResponse.json(
                    { error: `Restaurant ${orderGroup.restaurantId} is currently closed. It is open from ${restaurantOpeningHours.openTime} to ${restaurantOpeningHours.closeTime} today.` },
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
                // Only include appliedOffer if it is defined, otherwise omit the field entirely
                const processedItem: ProcessedOrderItem = {
                    id: item.id,
                    qty: item.qty,
                    name: dishData.name, // Store dish name for historical accuracy
                    basePrice: dishData.price,
                    finalPricePerUnit: effectivePricePerUnit,
                };
                if (appliedOffer && offerSource) {
                    processedItem.appliedOffer = { ...appliedOffer, source: offerSource } as Offer & { source: string };
                }
                // If no offer, do not set appliedOffer at all (it will be omitted from Firestore doc)
                processedItems.push(processedItem);
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

            // Pre-generate a document reference for the order to be used in the next pass
            orderRefs.push(db.collection("orders").doc());
        }

        let total = processedOrderGroups.reduce((sum, group) => sum + group.total, 0);
        total = Math.round(total);

        const access_token = await getAccessToken();
        const merchantOrderId = randomUUID();

        try {
            const ppRes = await axios.post("https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/sdk/order", JSON.stringify({
                'merchantOrderId': merchantOrderId,
                'amount': (total * 100).toString(),
                'callbackUrl': 'https://webhook.site/955ab2cd-124b-468b-893f-5c1cd024ced5',
                'paymentFlow': {
                    'type': 'PG_CHECKOUT'
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `O-Bearer ${access_token}`
                }
            });

            // Determine the initial order status based on the PhonePe payment state
            let initialOrderStatus: string;
            switch (ppRes.data.state) {
                case 'COMPLETED':
                    initialOrderStatus = 'PLACED';
                    break;
                case 'PENDING':
                case 'CREATED': // PhonePe initiate typically returns 'CREATED' or 'PENDING'
                    initialOrderStatus = 'PENDING';
                    break;
                case 'FAILED':
                case 'CANCELLED':
                default:
                    initialOrderStatus = 'CANCELLED';
                    break;
            }

            for (let orderRefIndex = 0; orderRefIndex < processedOrderGroups.length; orderRefIndex++) {
                const processedGroup = processedOrderGroups[orderRefIndex];

                const orderData = {
                    userId: userId,
                    restaurantId: processedGroup.restaurantId || null,
                    merchantOrderId,
                    items: processedGroup.items,
                    itemTotal: processedGroup.itemTotal,
                    status: initialOrderStatus, // Set initial order status based on payment state
                    transactionId: ppRes.data.orderId,
                    paymentMode: "ONLINE",
                    paymentState: ppRes.data.state,
                    expireAt: new Date(ppRes.data.expireAt),
                    delivery: processedGroup.delivery,
                    gst: processedGroup.gst,
                    platformFee: processedGroup.platformFee,
                    total: processedGroup.total,
                    address,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                await orderRefs[orderRefIndex].set(orderData);
            }

            return NextResponse.json({
                orderId: ppRes.data.orderId,
                token: ppRes.data.token,
                merchantOrderId
            });
        } catch (axiosError) {
            console.error("PhonePe API Error:", axiosError);
            if (axios.isAxiosError(axiosError)) {
                return NextResponse.json(
                    { 
                        error: "Payment gateway error", 
                        details: axiosError.response?.data || axiosError.message 
                    },
                    { status: axiosError.response?.status || 500 }
                );
            }
            throw axiosError;
        }

    } catch (error: unknown) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

import { db } from './firebaseAdmin.js';

export async function getRiderByPINCode(sourcePINCode: number, destinationPINCode: number) {
    try {
        // Query riders collection where both source and destination PIN codes are in servicePinCode array and rider is available
        const ridersRef = db.collection('riders');
        const query = ridersRef
            .where('servicePinCode', 'array-contains', sourcePINCode)
            .where('isAvailable', '==', true);
        const snapshot = await query.get();

        if (snapshot.empty) {
            return null; // No rider found with source PIN code
        }

        // Filter riders to check if destination PIN code is also in their servicePinCode array
        const filteredRiders = snapshot.docs.filter(doc => {
            const riderData = doc.data();
            return riderData.servicePinCode && riderData.servicePinCode.includes(destinationPINCode);
        });

        if (filteredRiders.length === 0) {
            return null; // No rider found that serves both source and destination PIN codes
        }

        return filteredRiders;

    } catch (error) {
        console.error('Error getting rider by PIN code:', error);
        throw error;
    }
}

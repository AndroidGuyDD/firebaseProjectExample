import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DBUser, MembershipRequest, AdminRequestBody } from './types';
import { validateFirebaseUser } from './utils';
import { document } from 'firebase-functions/lib/providers/firestore';

// globally initialize the SDK.
admin.initializeApp();

const serverZone = 'europe-west1';
const firestoreInstance = new admin.firestore.Firestore();
const firebaseAuthInstance = admin.auth();
const messagingInstance = admin.messaging();

// configure firestore
firestoreInstance.settings({ timestampsInSnapshots: true });

// FIRESTORE AUTH TRIGGER
// auth trigger: create own user model in firestore
export const onAuthUserCreated = functions.region(serverZone).auth.user().onCreate(async (authUser, context) => {
    // write user
    try {
        const user = {
            name: authUser.displayName,
            email: authUser.email,
            isAdmin: false,
            registerDate: admin.firestore.FieldValue.serverTimestamp()
        };

        await firestoreInstance.collection('users')
            .doc(authUser.uid)
            .set(user);

        console.log(`Writing user ${user}`);
    } catch (error) {
        console.error(error);
    }
});

// FIRESTORE DOCUMENT TRIGGER
// on every new membership request, send push to room admins
export const onRoomMembershipRequest = functions.region(serverZone).firestore
    .document('chat_rooms/{roomId}/membership_request/{requestId}').onCreate(async (change, context) => {
        const membershipRequest = change.data() as MembershipRequest;
        const roomAdminsSnap = await firestoreInstance.collection('users')
            .where(`roomAdmin.${membershipRequest.userId}`, '==', true)
            .get();

        if (roomAdminsSnap.empty) {
            console.log('No admins for room found');
        }

        roomAdminsSnap.forEach(adminDoc => {
            const dbUser = adminDoc.data() as DBUser;
            try {
                messagingInstance.sendToDevice(dbUser.fcmToken, {
                    notification: {
                        title: `New Room membership request for room ${membershipRequest.roomName}`
                    }
                });
            } catch (error) {
                console.error(error);
            }
        })
    });

// FIRESTORE HTTPS FUNCTION
// toggles the isAdmin flag in a user. Only possible if request context user is admin himself   
export const makeUserAdmin = functions.region(serverZone).https.onRequest(async (request, response) => {
    if (request.method !== 'PUT') {
        response.status(403).json({ error: 'Just accept PUT methods' });
        return;
    }

    const payload = request.body as AdminRequestBody;
    if (!payload.userId || !payload.isAdmin) {
        response.status(400).json({ error: 'UserId and isAdmin must be set in request body.' });
        return;
    }

    try {
        // we have to take care of the autentication ourselves 
        const firebaseToken = await validateFirebaseUser(request, firebaseAuthInstance);

        const dbUserDoc = await firestoreInstance.collection('users')
            .doc(firebaseToken.uid)
            .get();

        if (!dbUserDoc.exists) {
            response.status(404).json({ error: 'No user found' });
            return;
        }

        const dbUser = dbUserDoc.data() as DBUser;

        if (!dbUser.isAdmin) {
            response.status(403).json({ error: 'Only Admins can do this operation' });
            return;
        }

        await firestoreInstance.collection('users')
            .doc(payload.userId)
            .update({
                isAdmin: payload.isAdmin
            })
        console.log(`User ${payload.userId} updated with isAdmin: ${payload.isAdmin}`);
        response.status(200).send();

    } catch (error) {
        console.error(error)
        response.status(403).json({ error: error.message });
    }
});

// FIRESTORE HTTPS CALLABLE FUNCTION
export const someCallable = functions.region(serverZone).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    console.log(`Request user id ${context.auth.uid} with name ${context.auth.token.name}`);

    if (!data.somePayload) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
            'one argument "somePayload"');
    }
    return {
        foo: 42,
        bar: "Don't know"
    }
});


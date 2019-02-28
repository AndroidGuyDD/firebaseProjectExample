import { Request } from 'firebase-functions';
import { auth } from 'firebase-admin';

export const validateFirebaseUser = async (request: Request, authInstance: auth.Auth): Promise<auth.DecodedIdToken> => {
    console.log('Check if request is authorized with Firebase ID token');

    if ((!request.headers.authorization || !(request.headers.authorization as string).startsWith('Bearer ')) &&
        !(request.cookies && request.cookies.__session)) {
        console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
            'Make sure you authorize your request by providing the following HTTP header:',
            'Authorization: Bearer <Firebase ID Token>',
            'or by passing a "__session" cookie.');

        return Promise.reject('Unauthorized');
    }

    let idToken;
    if (request.headers.authorization && (request.headers.authorization as string).startsWith('Bearer ')) {
        console.log('Found "Authorization" header');
        // Read the ID Token from the Authorization header.
        idToken = (request.headers.authorization as string).split('Bearer ')[1];
    } else if (request.cookies) {
        console.log('Found "__session" cookie');
        // Read the ID Token from cookie.
        idToken = request.cookies.__session;
    } else {
        // No cookie
        return Promise.reject('Unauthorized');
    }

    try {
        const decodedIdToken = await authInstance.verifyIdToken(idToken);
        console.log('ID Token correctly decoded', decodedIdToken);
        return decodedIdToken;
    } catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        return Promise.reject('Error while verifying Firebase ID token');
    };
}
import { initializeApp, cert, getApps, ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import serviceAccount from '../service_key.json' with { type : "json"}


let messaging: any;
if(!getApps.length){

    
    const app = initializeApp({
        credential : cert(serviceAccount as ServiceAccount)
    })

    messaging = getMessaging(app)
} else {
    messaging = getMessaging()
    
}


export { messaging }
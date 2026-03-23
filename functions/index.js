const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Listen for new notifications in Firestore and send FCM push notification
exports.sendPushNotification = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    // We only want to send push notifications for unread ones (which is the default anyway)
    if (!notification || !notification.userId) return null;

    try {
      const userDoc = await admin.firestore().collection("users").doc(notification.userId).get();
      
      if (!userDoc.exists) {
        console.log(`No user document for userId: ${notification.userId}`);
        return null;
      }
      
      const userData = userDoc.data();
      const tokens = userData.fcmTokens;
      
      if (!tokens || tokens.length === 0) {
        console.log(`User has no FCM tokens: ${notification.userId}`);
        return null;
      }
      
      // Determine link or default to order history
      const clickAction = notification.link 
        ? `https://zbuild.app${notification.link}` 
        : "https://zbuild.app/orders";
      
      // Construct the message payload
      const payload = {
        notification: {
          title: notification.title || "Thông báo mới từ Zbuild",
          body: notification.message || "Bạn có một thông báo mới.",
        },
        data: {
          link: clickAction,
          type: notification.type || "general"
        }
      };
      
      // Send notifications to all tokens
      const response = await admin.messaging().sendToDevice(tokens, payload);
      
      // Clean up invalid tokens
      const tokensToRemove = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error("Failure sending notification to", tokens[index], error);
          if (error.code === "messaging/invalid-registration-token" ||
              error.code === "messaging/registration-token-not-registered") {
            tokensToRemove.push(tokens[index]);
          }
        }
      });
      
      if (tokensToRemove.length > 0) {
        await userDoc.ref.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
        });
        console.log(`Cleaned up ${tokensToRemove.length} invalid tokens for user ${notification.userId}`);
      }
      
      return null;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return null;
    }
  });

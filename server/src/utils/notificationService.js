const admin = require("firebase-admin");
const User = require("../models/Users");

/**
 * إرسال إشعار لمستخدم حسب الـ userId
 */
async function sendNotificationToUser(userId, title, body) {
  try {
    const user = await User.findById(userId);

    if (!user || !user.fcmToken) {
      throw new Error("FCM Token not found for user.");
    }

    const message = {
      notification: {
        title,
        body,
      },
      token: user.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);

    return response;
  } catch (error) {
    console.error("❌ Error sending notification:", error.message);
    throw error;
  }
}

module.exports = { sendNotificationToUser };

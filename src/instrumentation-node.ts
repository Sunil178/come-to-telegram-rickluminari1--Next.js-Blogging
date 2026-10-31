import dbConnect from "@/libs/db-connect";
import "@/models/User";
import "@/models/Category";
import "@/models/Post";
import "@/models/PostView";
import "@/models/Notification";
import "@/models/PushSubscription";
import { logger } from "@/libs/logger";
import { syncNotificationReadTtl } from "@/libs/notification-ttl";

export async function registerNode() {
  logger.info("Instrumentation hook: Connecting to DB and registering models...");
  await dbConnect();
  // Not awaited: index maintenance (and a one-time backfill) must not delay the server becoming ready.
  void syncNotificationReadTtl();
}

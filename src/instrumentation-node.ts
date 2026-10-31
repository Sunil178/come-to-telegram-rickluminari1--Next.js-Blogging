import dbConnect from "@/libs/db-connect";
import "@/models/User";
import "@/models/Category";
import "@/models/Post";
import "@/models/PostView";
import "@/models/Notification";
import "@/models/PushSubscription";
import { logger } from "@/libs/logger";

export async function registerNode() {
  logger.info("Instrumentation hook: Connecting to DB and registering models...");
  await dbConnect();
}

import dbConnect from "@/libs/db-connect";
import "@/models/User";
import "@/models/Category";
import "@/models/Post";
import "@/models/PostView";
import "@/models/Notification";
import "@/models/PushSubscription";

export async function registerNode() {
  console.log('Instrumentation hook: Connecting to DB and registering models...');
  await dbConnect();
}

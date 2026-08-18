import dbConnect from "@/libs/db-connect";
import "@/models/Category";
import "@/models/Post";
import "@/models/PostView";

export async function registerNode() {
  console.log('Instrumentation hook: Connecting to DB and registering models...');
  await dbConnect();
}

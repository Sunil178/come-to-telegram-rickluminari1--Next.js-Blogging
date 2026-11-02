import { auth } from "@/app/api/auth/[...nextauth]/auth";
import NavbarBar from "@/components/nav/NavbarBar";
import { pushPublicKey } from "@/libs/notify";

export default async function Navbar() {
    const session = await auth();
    const user = session?.user
        ? { name: session.user.name, email: session.user.email, image: session.user.image, role: session.user.role }
        : null;

    return <NavbarBar user={user} vapidPublicKey={pushPublicKey()} />;
}

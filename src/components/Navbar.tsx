import { auth } from "@/app/api/auth/[...nextauth]/auth";
import NavbarBar from "@/components/nav/NavbarBar";

export default async function Navbar() {
    const session = await auth();
    const user = session?.user
        ? { name: session.user.name, email: session.user.email, image: session.user.image }
        : null;

    return <NavbarBar user={user} />;
}

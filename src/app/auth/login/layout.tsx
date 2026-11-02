// The page is a client component, which can't export metadata.
export const metadata = { title: "Log in", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}

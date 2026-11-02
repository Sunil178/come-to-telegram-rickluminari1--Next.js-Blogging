// The page is a client component, which can't export metadata.
export const metadata = { title: "Forgot password", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}

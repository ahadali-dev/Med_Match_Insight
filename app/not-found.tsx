import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-body">That client or page doesn&apos;t exist.</p>
      <Link href="/" className="font-semibold">
        Go to the first client
      </Link>
    </main>
  );
}

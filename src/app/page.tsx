import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();
  return (
    <main className="max-w-2xl mx-auto px-5 py-12">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-primary">Graazo</h1>
        {session ? (
          <LogoutButton />
        ) : (
          <Link
            href="/login"
            className="min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Login
          </Link>
        )}
      </header>
      <p className="text-gray-600 mb-6">
        Insurance policy tracking for agency staff. Start the dev server with{" "}
        <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">
          npm run dev
        </code>
        .
      </p>
      <ul className="space-y-2">
        <li>
          <Link
            href="/dashboard"
            className="text-primary hover:text-primary-light font-medium"
          >
            Dashboard
          </Link>
        </li>
        <li>
          <Link
            href="/clients"
            className="text-primary hover:text-primary-light font-medium"
          >
            Clients
          </Link>
        </li>
        <li>
          <Link
            href="/policies"
            className="text-primary hover:text-primary-light font-medium"
          >
            Policies
          </Link>
        </li>
        <li>
          <Link
            href="/import"
            className="text-primary hover:text-primary-light font-medium"
          >
            Import
          </Link>
        </li>
        <li>
          <Link
            href="/settings/users"
            className="text-primary hover:text-primary-light font-medium"
          >
            Team
          </Link>
        </li>
        <li>
          <Link
            href="/settings/households"
            className="text-primary hover:text-primary-light font-medium"
          >
            Households
          </Link>
        </li>
        <li className="pt-4 text-gray-500 text-sm">
          App Router lives in <code className="font-mono bg-gray-100 px-1 rounded">src/app</code>
        </li>
        <li className="text-gray-500 text-sm">
          Lint with <code className="font-mono bg-gray-100 px-1 rounded">npm run lint</code>, typecheck with{" "}
          <code className="font-mono bg-gray-100 px-1 rounded">npm run typecheck</code>
        </li>
      </ul>
    </main>
  );
}

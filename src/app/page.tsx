import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function HomePage() {
  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Policy Tracker</h1>
        <LogoutButton />
      </header>
      <p>
        Next.js is wired up. Start the dev server with <code>npm run dev</code>.
      </p>
      <ul>
        <li>
          <Link href="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link href="/clients">Clients</Link>
        </li>
        <li>
          <Link href="/policies">Policies</Link>
        </li>
        <li>
          <Link href="/import">Import</Link>
        </li>
        <li>
          <Link href="/settings/users">Team</Link>
        </li>
        <li>
          <Link href="/settings/households">Households</Link>
        </li>
        <li>
          App Router lives in <code>src/app</code>
        </li>
        <li>
          Lint with <code>npm run lint</code>, typecheck with <code>npm run typecheck</code>
        </li>
      </ul>
    </main>
  );
}


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
          App Router lives in <code>src/app</code>
        </li>
        <li>
          Lint with <code>npm run lint</code>, typecheck with <code>npm run typecheck</code>
        </li>
      </ul>
    </main>
  );
}


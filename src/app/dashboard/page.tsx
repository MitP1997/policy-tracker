import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getExpiryBuckets, type ExpiryBucketItem } from "@/lib/dashboard";
import { LogoutButton } from "@/components/LogoutButton";
import { QuickStatusSelect } from "@/components/QuickStatusSelect";

function BucketSection({
  title,
  items
}: {
  title: string;
  items: ExpiryBucketItem[];
}) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p>No policies.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.links.detail}>{item.clientFullName ?? "—"}</Link>
              {" · "}
              {item.insurerName} · {item.policyNumber ?? "—"} · ends {item.endDate}
              {" · "}
              <QuickStatusSelect policyId={item.id} currentStatus={item.status} />
              {" · "}
              <Link href={item.links.edit}>Edit</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?from=/dashboard");
  }

  let buckets;
  try {
    const db = await getDb();
    buckets = await getExpiryBuckets(db, session, 60);
  } catch {
    return (
      <main>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <h1>Expiry Dashboard</h1>
          <LogoutButton />
        </header>
        <p>Unable to load dashboard. Please try again.</p>
      </main>
    );
  }

  return (
    <main>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h1>Expiry Dashboard</h1>
        <LogoutButton />
      </header>
      <p>
        <Link href="/reminders">Today&apos;s reminders</Link>
        {" · "}
        Policies grouped by expiry. Sorted by earliest first.
      </p>
      <BucketSection title="Already expired" items={buckets.expired} />
      <BucketSection title="Expiring in 0–7 days" items={buckets["0-7"]} />
      <BucketSection title="Expiring in 8–30 days" items={buckets["8-30"]} />
      <BucketSection title="Expiring in 31–60 days" items={buckets["31-60"]} />
    </main>
  );
}

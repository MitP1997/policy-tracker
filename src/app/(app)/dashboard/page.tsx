import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getExpiryBuckets, type ExpiryBucketItem } from "@/lib/dashboard";
import { QuickStatusSelect } from "@/components/QuickStatusSelect";

function BucketSection({
  title,
  items,
}: {
  title: string;
  items: ExpiryBucketItem[];
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">No policies.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 px-3 rounded-lg bg-white border border-gray-200 shadow-card"
            >
              <Link
                href={item.links.detail}
                className="font-medium text-primary hover:text-primary-light"
              >
                {item.clientFullName ?? "—"}
              </Link>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">{item.insurerName}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">{item.policyNumber ?? "—"}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-600">ends {item.endDate}</span>
              <span className="text-gray-500">·</span>
              <QuickStatusSelect policyId={item.id} currentStatus={item.status} />
              <span className="text-gray-500">·</span>
              <Link
                href={item.links.edit}
                className="text-sm text-primary hover:text-primary-light"
              >
                Edit
              </Link>
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
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          Expiry Dashboard
        </h1>
        <p className="text-red-600">Unable to load dashboard. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        Expiry Dashboard
      </h1>
      <p className="text-gray-600 mb-6">
        <Link
          href="/reminders"
          className="font-medium text-primary hover:text-primary-light"
        >
          Today&apos;s reminders
        </Link>
        {" · "}
        Policies grouped by expiry. Sorted by earliest first.
      </p>
      <BucketSection title="Already expired" items={buckets.expired} />
      <BucketSection title="Expiring in 0–7 days" items={buckets["0-7"]} />
      <BucketSection title="Expiring in 8–30 days" items={buckets["8-30"]} />
      <BucketSection title="Expiring in 31–60 days" items={buckets["31-60"]} />
    </div>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationSettings } from "@/components/NotificationSettings";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifyOnCreate: true, notifyOnUpdate: true, notifyOnDelete: true },
  });

  if (!user) redirect("/auth/signin");

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">設定</h1>
      <NotificationSettings initial={user} />
    </div>
  );
}

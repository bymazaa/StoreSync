import { ContactsPage } from "@/components/modules/contacts-page";

export const instant = false;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <ContactsPage key={typeof q === "string" ? q : ""} mode="supplier" initialSearch={typeof q === "string" ? q : ""} />;
}

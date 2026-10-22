import { ProductsPage } from "@/components/modules/products-page";

export const instant = false;

export default async function ProductsRoute({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <ProductsPage key={typeof q === "string" ? q : ""} initialSearch={typeof q === "string" ? q : ""} />;
}

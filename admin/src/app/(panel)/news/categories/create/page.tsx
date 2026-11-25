"use client";

import { CategoryForm } from "@/components/news/category-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreateCategoryPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader back="/news/categories" backLabel="Categories" title="Add category" />
      <CategoryForm onSaved={() => router.push("/news/categories")} />
    </>
  );
}

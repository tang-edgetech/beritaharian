"use client";

import { CategoryForm } from "@/components/news/category-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { NewsCategory } from "@cendol/api-client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

export default function EditCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["news-category", slug],
    queryFn: () => api.get<{ data: NewsCategory }>(`admin/news/categories/${slug}`).then((r) => r.data),
  });

  return (
    <>
      <PageHeader back="/news/categories" backLabel="Categories" title={query.data ? query.data.name : <Skeleton className="h-8 w-48" />} />
      {query.isPending ? (
        <Skeleton className="h-80 w-full max-w-2xl rounded-xl" />
      ) : query.isError ? (
        <p className="panel-card">{query.error.message}</p>
      ) : (
        <CategoryForm category={query.data} onSaved={(saved) => router.replace(`/news/categories/${saved.slug}`)} />
      )}
    </>
  );
}

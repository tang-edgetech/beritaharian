"use client";

import { ArticleForm } from "@/components/news/article-form";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "next/navigation";

export default function CreateArticlePage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        back="/news"
        backLabel="Stories"
        title="Write a story"
        description="Save a draft first. When it's ready, send it for fact-check from the story page."
      />
      <div className="article-create max-w-4xl">
        <ArticleForm onSaved={(article) => router.replace(`/news/${article.id}/edit`)} />
      </div>
    </>
  );
}

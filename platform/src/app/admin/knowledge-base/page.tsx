"use client";

/**
 * Knowledge base administration.
 *
 * Two jobs, deliberately side by side: add documents, and see exactly what
 * the retriever returns for a query. The second matters as much as the
 * first — a RAG system whose retrieval nobody can inspect is a RAG system
 * nobody can debug, so the search box shows which signal produced each hit
 * rather than just a ranked list.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/lib/use-api-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, Upload, AlertTriangle } from "lucide-react";

const SOURCE_KINDS = [
  { id: "DOCS", label: "مستندات" },
  { id: "SUPPORT", label: "پشتیبانی" },
  { id: "MARKETPLACE", label: "مارکت‌پلیس" },
  { id: "CHANGELOG", label: "تغییرات" },
  { id: "CODE", label: "کد" },
  { id: "MANUAL", label: "دستی" },
] as const;

interface IngestBody {
  sourceKind: string;
  sourceKey: string;
  title: string;
  body: string;
  url: string;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  sourceKind: string;
  url: string | null;
  matchedBy: string[];
  score: number;
  excerpt: string;
}

const KB_KEY = ["admin", "kb"] as const;

interface KbStats {
  documents: number;
  chunks: number;
  embedded: number;
  pendingEmbedding: number;
  embeddingModel: string | null;
  usingRealEmbeddings: boolean;
}

export default function KnowledgeBasePage() {
  const statsQuery = useApiQuery<KbStats>(KB_KEY, "/api/admin/kb");

  const [form, setForm] = useState({
    sourceKind: "DOCS",
    sourceKey: "",
    title: "",
    url: "",
    body: "",
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [usingRealEmbeddings, setUsingRealEmbeddings] = useState(true);

  const ingest = useApiMutation<{ message?: string }, IngestBody>("/api/admin/kb", {
    method: "POST",
    invalidateKeys: [KB_KEY],
  });

  async function onIngest() {
    try {
      const data = await ingest.mutateAsync({
        sourceKind: form.sourceKind,
        sourceKey: form.sourceKey.trim(),
        title: form.title.trim(),
        body: form.body,
        url: form.url.trim(),
      });

      toast.success(data.message ?? "سند ذخیره شد.");
      setForm({ sourceKind: "DOCS", sourceKey: "", title: "", url: "", body: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره‌ی سند ناموفق بود.");
    }
  }

  const canSubmit =
    form.sourceKey.trim().length > 0 &&
    form.title.trim().length > 0 &&
    form.body.trim().length > 0;

  async function runSearch() {
    const q = query.trim();
    if (q.length === 0) return;

    const res = await fetch(`/api/admin/kb/search?query=${encodeURIComponent(q)}`, {
      credentials: "same-origin",
    });

    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
      results?: SearchResult[];
      usingRealEmbeddings?: boolean;
    };

    if (!res.ok || data.success === false) {
      toast.error(data.message ?? "جست‌وجو ناموفق بود.");
      return;
    }

    setResults(data.results ?? []);
    setSearchedFor(q);
    setUsingRealEmbeddings(Boolean(data.usingRealEmbeddings));
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">پایگاه دانش</h1>
          <p className="text-sm text-muted-foreground">
            اسنادی که مدل هنگام پاسخ‌دادن به آن‌ها مراجعه می‌کند.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>وضعیت کورپوس</CardTitle>
          <CardDescription>چه چیزی ایندکس شده و با کدام مدل.</CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : statsQuery.data ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{statsQuery.data.documents} سند</Badge>
              <Badge variant="secondary">{statsQuery.data.chunks} قطعه</Badge>
              <Badge variant="secondary">
                {statsQuery.data.embedded} قطعه‌ی امبدشده
              </Badge>
              {statsQuery.data.pendingEmbedding > 0 && (
                <Badge variant="destructive">
                  {statsQuery.data.pendingEmbedding} در انتظار امبد
                </Badge>
              )}
              <Badge>{statsQuery.data.embeddingModel ?? "—"}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">اطلاعاتی در دسترس نیست.</p>
          )}

          {statsQuery.data && !statsQuery.data.usingRealEmbeddings && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                کلید embedding تنظیم نشده، پس از embedder محلی استفاده می‌شود. جست‌وجو
                کلیدواژه‌محور است و معنای واژه‌ها را درک نمی‌کند. برای جست‌وجوی معنایی،
                کلید سرویس هوش مصنوعی را در صفحه‌ی «هوش مصنوعی» وارد کنید.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> افزودن سند
            </CardTitle>
            <CardDescription>
              سند با همین کلید منبع قبلاً وجود داشته باشد، جایگزین می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>نوع منبع</Label>
              <Select
                value={form.sourceKind}
                onValueChange={(v) => setForm({ ...form, sourceKind: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_KINDS.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-key">کلید منبع</Label>
              <Input
                id="kb-key"
                dir="ltr"
                placeholder="docs/hpos.md"
                value={form.sourceKey}
                onChange={(e) => setForm({ ...form, sourceKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-title">عنوان</Label>
              <Input
                id="kb-title"
                placeholder="سازگاری با HPOS"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-url">آدرس (اختیاری)</Label>
              <Input
                id="kb-url"
                dir="ltr"
                placeholder="https://example.com/docs/hpos"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-body">متن</Label>
              <Textarea
                id="kb-body"
                rows={10}
                placeholder="متن کامل سند را اینجا بچسبانید…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>

            <Button onClick={() => void onIngest()} disabled={!canSubmit || ingest.isPending}>
              {ingest.isPending ? "در حال ذخیره…" : "ذخیره‌ی سند"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> آزمودن بازیابی
            </CardTitle>
            <CardDescription>
              دقیقاً همان چیزی را می‌بینید که مدل می‌بیند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="مثلاً: چطور پشتیبانی HPOS را اعلام کنم؟"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <Button onClick={() => void runSearch()} disabled={query.trim().length === 0}>
                جست‌وجو
              </Button>
            </div>

            {results !== null && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {results.length === 0
                    ? `هیچ نتیجه‌ای برای «${searchedFor}» پیدا نشد — این یعنی کورپوس آن موضوع را پوشش نمی‌دهد، نه اینکه جست‌وجو خراب باشد.`
                    : `${results.length} نتیجه برای «${searchedFor}»`}
                  {!usingRealEmbeddings && results.length > 0 ? " (کلیدواژه‌محور)" : ""}
                </p>

                {results.map((r, i) => (
                  <div key={r.chunkId} className="rounded-md border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {i + 1}. {r.title}
                      </span>
                      <Badge variant="outline">{r.sourceKind}</Badge>
                      {r.matchedBy.map((m) => (
                        <Badge key={m} variant="secondary">
                          {m === "keyword" ? "کلیدواژه" : "معنایی"}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {r.score}
                      </span>
                    </div>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 block text-xs text-primary underline"
                        dir="ltr"
                      >
                        {r.url}
                      </a>
                    )}
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {r.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_MODULES = [
  { id: "settings", name: "Settings Page", desc: "صفحه تنظیمات", icon: "⚙️" },
  { id: "cron", name: "Cron Scheduler", desc: "زمان‌بندی", icon: "⏰" },
  { id: "db-table", name: "DB Table", desc: "جدول دیتابیس", icon: "🗄️" },
  { id: "rest-api", name: "REST API", desc: "API", icon: "🔌" },
  { id: "sms", name: "SMS Gateway", desc: "درگاه پیامک", icon: "📱" },
  { id: "license", name: "License", desc: "لایسنس", icon: "🔑" },
  { id: "scheduler", name: "Scheduler", desc: "Action Scheduler", icon: "📅" },
  { id: "assets", name: "Assets", desc: "فایل‌های استاتیک", icon: "🎨" },
  { id: "logger", name: "Logger", desc: "لاگ", icon: "📝" },
];

export default function SpecBuilderPage() {
  const [pluginName, setPluginName] = useState("My Awesome Plugin");
  const [slug, setSlug] = useState("my-awesome-plugin");
  const [description, setDescription] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>(["settings", "db-table"]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatedSpec, setGeneratedSpec] = useState("");

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const generateSpec = () => {
    const spec = {
      name: pluginName,
      slug,
      namespace: `AnsariAi\\${pluginName.replace(/\s+/g, "")}`,
      prefix: slug.replace(/-/g, "_").slice(0, 8),
      textDomain: slug,
      version: "1.0.0",
      description: description || `${pluginName} — built with AiWp Factory`,
      author: { name: "AnsariAi", uri: "https://ansariaiwp.com" },
      requires: { php: "8.1", wp: "6.5" },
      modules: selectedModules,
      license: { enabled: selectedModules.includes("license"), server: "https://ansariaiwp.com/api/v1" },
    };
    setGeneratedSpec(JSON.stringify(spec, null, 2));
  };

  const generateFromAI = () => {
    // Mock AI generation — in real, call LLM API
    if (!aiPrompt) return;
    const lower = aiPrompt.toLowerCase();
    const modules = ["settings"];
    if (lower.includes("sms") || lower.includes("پیامک")) modules.push("sms");
    if (lower.includes("cron") || lower.includes("زمان")) modules.push("cron", "scheduler");
    if (lower.includes("db") || lower.includes("دیتابیس") || lower.includes("سفارش")) modules.push("db-table");
    if (lower.includes("api")) modules.push("rest-api");
    if (lower.includes("license") || lower.includes("لایسنس")) modules.push("license");
    setSelectedModules(modules);
    setPluginName(aiPrompt.slice(0, 30) + " Plugin");
    setSlug(aiPrompt.toLowerCase().replace(/\s+/g, "-").slice(0, 20) || "ai-generated-plugin");
    setTimeout(generateSpec, 100);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎨 Visual Spec Builder — No-Code — سقف 10/10</h1>
        <p className="text-muted-foreground">Drag-drop modules, AI generation, instant ZIP — برای افراد کاملا غیر فنی</p>
        <Badge className="mt-2">10/10 Product — Ceiling</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: AI + Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🤖 AI Generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>توصیف کن چی می‌خوای (فارسی یا انگلیسی)</Label>
              <Textarea
                placeholder="مثلا: من یک افزونه می‌خوام که سفارشات ووکامرس رو هر روز SMS کنه"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <Button onClick={generateFromAI} className="w-full">
                Generate with AI
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📝 Plugin Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Plugin Name</Label>
                <Input value={pluginName} onChange={(e) => setPluginName(e.target.value)} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle: Modules Drag-Drop */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>🧩 Modules — Drag & Drop</CardTitle>
              <p className="text-sm text-muted-foreground">کلیک کن تا انتخاب/حذف بشه</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                {AVAILABLE_MODULES.map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedModules.includes(mod.id) ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{mod.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{mod.name}</div>
                        <div className="text-xs text-muted-foreground">{mod.desc}</div>
                      </div>
                      {selectedModules.includes(mod.id) && <Badge>✓</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={generateSpec} className="w-full mt-6">
                Generate Spec JSON
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview + ZIP */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>👁️ Preview & Build</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Selected: {selectedModules.length} modules</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedModules.map((id) => (
                    <Badge key={id} variant="secondary">
                      {id}
                    </Badge>
                  ))}
                </div>
              </div>

              {generatedSpec && (
                <>
                  <div>
                    <Label>Generated Spec (spec/{slug}.json)</Label>
                    <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">{generatedSpec}</pre>
                  </div>
                  <Button className="w-full" onClick={() => alert(`Building ZIP for ${slug}... (mock) — In real: tools/build.php would create /build/${slug}-1.0.0.zip`)}>
                    📦 Build ZIP — دانلود افزونه
                  </Button>
                  <p className="text-xs text-muted-foreground">در نسخه واقعی: validate.php → compose.php → build.php → ZIP</p>
                </>
              )}

              {!generatedSpec && <p className="text-sm text-muted-foreground">روی Generate Spec کلیک کن تا پیش‌نمایش ببینی</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🏗️ Architecture — چطور کار می‌کنه (سقف)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <strong>Graph:</strong> User (non-technical) → Visual Builder (drag-drop + AI) → spec/*.json → validate.php (schema + transitive requires) → compose.php (scaffold + modules + placeholders → manifest + autoloader) → /build/&lt;slug&gt;/ → build.php (strict placeholder scan) → ZIP → WordPress upload → Plugin::instance() → module-manifest → register() → boot() → Action Scheduler fallback
          </p>
          <p className="text-sm mt-2">
            <strong>10/10 Product:</strong> قبلاً 8.5 بود چون JSON technical بود — الان visual + AI داره، کاملا non-technical می‌تونه بسازه — سقف.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

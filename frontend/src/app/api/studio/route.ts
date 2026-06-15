import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, GitHubError } from "@/lib/github";
import { requireAuth } from "@/lib/auth";
import type { VideoProject, Scene } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "config/studio.json";

interface StudioData {
  projects: VideoProject[];
}

function fail(e: unknown) {
  const status = e instanceof GitHubError ? e.status : 500;
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function GET(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  try {
    const data = await readJsonFile<StudioData>(PATH, { projects: [] });
    return NextResponse.json({ projects: data.projects || [] });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  const unauth = await requireAuth(request);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const action = body?.action;

  if (!["create", "update", "update_scene", "add_scene", "remove_scene", "reorder_scenes", "delete", "set_status"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  try {
    const result = await updateJsonFile<StudioData>(
      PATH,
      (data) => {
        if (!Array.isArray(data.projects)) data.projects = [];

        if (action === "create") {
          if (!body.title?.trim()) throw new Error("title required");
          const sceneCount = Math.max(1, Math.min(50, Number(body.scene_count) || 5));
          const totalDuration = Math.max(5, Number(body.total_duration_seconds) || 30);
          const perScene = Math.round(totalDuration / sceneCount);

          const scenes: Scene[] = Array.from({ length: sceneCount }, (_, i) => ({
            id: uid(),
            order: i + 1,
            duration_seconds: perScene,
            text: "",
            image_url: "",
            image_prompt: "",
            transition: i === 0 ? "cut" as const : "fade" as const,
          }));

          const project: VideoProject = {
            id: uid(),
            title: String(body.title).trim(),
            mode: body.mode === "manual" ? "manual" : "quick",
            format: body.format === "long" ? "long" : "short",
            total_duration_seconds: totalDuration,
            scene_count: sceneCount,
            niche: body.niche || "",
            topic: body.topic || "",
            scenes,
            status: "draft",
            created_at: new Date().toISOString(),
          };
          data.projects.unshift(project);
        } else if (action === "update") {
          const p = data.projects.find(x => x.id === body.id);
          if (p) {
            if (body.title !== undefined) p.title = body.title;
            if (body.topic !== undefined) p.topic = body.topic;
            if (body.niche !== undefined) p.niche = body.niche;
            if (body.total_duration_seconds !== undefined) p.total_duration_seconds = Number(body.total_duration_seconds);
          }
        } else if (action === "update_scene") {
          const p = data.projects.find(x => x.id === body.project_id);
          if (p) {
            const s = p.scenes.find(x => x.id === body.scene_id);
            if (s) {
              if (body.text !== undefined) s.text = body.text;
              if (body.duration_seconds !== undefined) s.duration_seconds = Math.max(1, Number(body.duration_seconds));
              if (body.image_url !== undefined) s.image_url = body.image_url;
              if (body.image_prompt !== undefined) s.image_prompt = body.image_prompt;
              if (body.transition !== undefined && ["cut", "fade", "dissolve", "slide", "zoom"].includes(body.transition)) {
                s.transition = body.transition;
              }
            }
          }
        } else if (action === "add_scene") {
          const p = data.projects.find(x => x.id === body.project_id);
          if (p) {
            const newScene: Scene = {
              id: uid(),
              order: p.scenes.length + 1,
              duration_seconds: body.duration_seconds || 5,
              text: "",
              image_url: "",
              image_prompt: "",
              transition: "fade",
            };
            p.scenes.push(newScene);
            p.scene_count = p.scenes.length;
          }
        } else if (action === "remove_scene") {
          const p = data.projects.find(x => x.id === body.project_id);
          if (p && p.scenes.length > 1) {
            p.scenes = p.scenes.filter(s => s.id !== body.scene_id);
            p.scenes.forEach((s, i) => { s.order = i + 1; });
            p.scene_count = p.scenes.length;
          }
        } else if (action === "reorder_scenes") {
          const p = data.projects.find(x => x.id === body.project_id);
          if (p && Array.isArray(body.scene_ids)) {
            const ordered: Scene[] = [];
            for (const id of body.scene_ids as string[]) {
              const s = p.scenes.find(x => x.id === id);
              if (s) ordered.push(s);
            }
            ordered.forEach((s, i) => { s.order = i + 1; });
            p.scenes = ordered;
          }
        } else if (action === "delete") {
          data.projects = data.projects.filter(p => p.id !== body.id);
        } else if (action === "set_status") {
          const p = data.projects.find(x => x.id === body.id);
          if (p && ["draft", "producing", "done"].includes(body.status)) {
            p.status = body.status;
          }
        }

        return data;
      },
      `studio: ${action}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

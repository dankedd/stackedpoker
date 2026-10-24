"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PROFILE, PROFILE_EDIT, socialErrorMessage } from "@/lib/social/strings";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

type Visibility = "public" | "friends" | "private";

export interface ProfileFormValues {
  id: string;
  handle: string | null;
  name: string;
  bio: string | null;
  sites: string[];
  avatar: string | null;
  profile_visibility: Visibility;
  stats_visibility: Visibility;
}

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIZE = 512;

/** Centre-crops to a square and re-encodes as a 512px WebP (well under 2 MB). */
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/webp", 0.88));
}

/** Settings → Profile: photo, bio, sites, visibility (update_my_profile / set_my_avatar). */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initial.avatar);
  const [uploading, setUploading] = useState(false);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [sites, setSites] = useState<string[]>(initial.sites);
  const [profileVis, setProfileVis] = useState<Visibility>(initial.profile_visibility);
  const [statsVis, setStatsVis] = useState<Visibility>(initial.stats_visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function replaceAvatar(next: string | null) {
    const { data, error: e } = await supabase.rpc("set_my_avatar", { p_path: next });
    if (e || !(data as { ok?: boolean } | null)?.ok) throw new Error(e?.message ?? "invalid");
    if (avatar) await supabase.storage.from("avatars").remove([avatar]);
    setAvatar(next);
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error(PROFILE_EDIT.avatarWrongType);
    if (file.size > MAX_BYTES) return toast.error(PROFILE_EDIT.avatarTooBig);
    setUploading(true);
    try {
      const blob = await squareWebp(file);
      const path = `${initial.id}/${Date.now()}.webp`;
      const { error: up } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (up) throw up;
      await replaceAvatar(path);
    } catch {
      toast.error(PROFILE_EDIT.avatarFailed);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("update_my_profile", {
      p_bio: bio.trim() || null,
      p_sites: sites,
      p_profile_visibility: profileVis,
      p_stats_visibility: statsVis,
    });
    setBusy(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (rpcError || !res?.ok) {
      setError(socialErrorMessage(rpcError?.message ?? res?.error));
      return;
    }
    toast.success(PROFILE_EDIT.saved);
    router.refresh();
  }

  if (!initial.handle) return <p className="text-sm text-muted-foreground">{PROFILE_EDIT.needHandle}</p>;

  return (
    <form onSubmit={save} className="space-y-5" data-profile-form>
      <div className="flex items-center gap-4">
        <Avatar path={avatar} name={initial.name} size={64} />
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm text-foreground hover:bg-white/[0.04] disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> {uploading ? PROFILE_EDIT.avatarUploading : PROFILE_EDIT.avatarUpload}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => replaceAvatar(null).catch(() => toast.error(PROFILE_EDIT.avatarFailed))}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" /> {PROFILE_EDIT.avatarRemove}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70">{PROFILE_EDIT.avatarHelp}</p>
          <input ref={fileRef} type="file" accept={TYPES.join(",")} className="hidden" onChange={onFile} />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-sm text-muted-foreground">
          <span>{PROFILE_EDIT.bio}</span>
          <span className="text-xs">{bio.length}/160</span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={2}
          placeholder={PROFILE_EDIT.bioPlaceholder}
          style={{ fontSize: "16px" }}
          className="w-full resize-none rounded-lg border border-border/60 bg-background/60 p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm text-muted-foreground">{PROFILE_EDIT.sites}</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PROFILE.sites).map(([id, label]) => {
            const on = sites.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setSites((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm transition-colors",
                  on ? "border-violet-500/60 bg-violet-500/15 text-violet-100" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <VisibilitySelect label={PROFILE_EDIT.profileVisibility} value={profileVis} onChange={setProfileVis} />
        <VisibilitySelect label={PROFILE_EDIT.statsVisibility} value={statsVis} onChange={setStatsVis} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-[#7C5CFF] px-4 text-sm font-semibold text-white hover:bg-[#6B4BEE] disabled:opacity-50"
        >
          {busy ? PROFILE_EDIT.saving : PROFILE_EDIT.save}
        </button>
        <Link href={`/u/${initial.handle}`} className="text-sm font-medium text-violet-300 hover:text-violet-200">
          {PROFILE_EDIT.viewProfile} →
        </Link>
      </div>
    </form>
  );
}

function VisibilitySelect({ label, value, onChange }: { label: string; value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Visibility)}
        style={{ fontSize: "16px" }}
        className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-foreground"
      >
        {(["public", "friends", "private"] as const).map((v) => (
          <option key={v} value={v}>
            {PROFILE_EDIT.visibilityOption[v]}
          </option>
        ))}
      </select>
    </label>
  );
}

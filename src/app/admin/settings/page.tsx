"use client"

// =============================================================================
// Admin — Settings editor (/admin/settings)
// Every SiteSetting row, grouped into cards by its "group" column. Edits are
// staged locally and saved in one batch PUT. Boolean settings render as
// toggles, numbers as number inputs, and JSON values get client-side
// validation that blocks saving while invalid.
// =============================================================================

import { Loader2, RefreshCw, Save, Settings2 } from "lucide-react"
import * as React from "react"

import {
  Toggle,
  adminFetch,
  adminMutate,
  toastApiError,
} from "@/components/admin"
import { Button, Input, Textarea } from "@/components/ui"
import { cn, titleCase } from "@/lib/utils"

type SettingRow = {
  key: string
  value: string
  type: string
  description: string | null
  group: string
  updatedBy: string | null
  updatedAt: string
}

/** "registration.ctf.maxTeamSize" → "Registration Ctf Max Team Size" */
function humanizeKey(key: string): string {
  return titleCase(
    key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " "),
  )
}

/** "registration" → "Registration" */
function humanizeGroup(group: string): string {
  return titleCase(group.replace(/[._-]+/g, " "))
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = React.useState<SettingRow[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetch<SettingRow[]>("/api/admin/settings")
      setSettings(data)
      setDrafts({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const groups = React.useMemo(() => {
    const map = new Map<string, SettingRow[]>()
    for (const setting of settings) {
      const bucket = map.get(setting.group)
      if (bucket) {
        bucket.push(setting)
      } else {
        map.set(setting.group, [setting])
      }
    }
    return [...map.entries()]
  }, [settings])

  const changedUpdates = React.useMemo(
    () =>
      settings
        .filter(
          (setting) => (drafts[setting.key] ?? setting.value) !== setting.value,
        )
        .map((setting) => ({
          key: setting.key,
          value: drafts[setting.key] ?? setting.value,
        })),
    [settings, drafts],
  )

  const jsonErrors = React.useMemo(() => {
    const errors: Record<string, string> = {}
    for (const setting of settings) {
      if (setting.type !== "json") {continue}
      const draft = drafts[setting.key]
      if (draft === undefined || draft.trim() === "") {continue}
      try {
        JSON.parse(draft)
      } catch {
        errors[setting.key] = "Invalid JSON. Fix it before saving."
      }
    }
    return errors
  }, [settings, drafts])

  const hasJsonErrors = Object.keys(jsonErrors).length > 0

  const setDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    if (changedUpdates.length === 0 || hasJsonErrors) {return}
    setSaving(true)
    try {
      const updated = await adminMutate<SettingRow[]>(
        "/api/admin/settings",
        "PUT",
        { updates: changedUpdates },
        { successMessage: "Settings updated." },
      )
      setSettings(updated)
      setDrafts({})
    } catch (err) {
      toastApiError(err, "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Site settings
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Key-value settings that drive the public site and the registration
            flow. Changes are saved in one batch and recorded in the audit log.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-panel py-16 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" aria-hidden="true" />
          Loading settings…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-pink/30 bg-pink/5 px-6 py-16 text-center">
          <p className="text-sm text-text-primary">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : settings.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-panel px-6 py-16 text-center">
          <p className="text-sm font-medium text-text-primary">
            No settings found
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Seed the database to create the default site settings.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-5">
            {groups.map(([group, rows]) => (
              <section
                key={group}
                className="rounded-lg border border-border bg-bg-panel p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-text-primary">
                    {humanizeGroup(group)}
                  </h2>
                  <span className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                    {rows.length} {rows.length === 1 ? "setting" : "settings"}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {rows.map((setting) => {
                    const label = humanizeKey(setting.key)
                    const value = drafts[setting.key] ?? setting.value
                    return (
                      <div
                        key={setting.key}
                        className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3"
                      >
                        {setting.type === "boolean" ? (
                          <Toggle
                            checked={value === "true"}
                            onChange={(checked) =>
                              setDraft(setting.key, checked ? "true" : "false")
                            }
                            label={label}
                            description={setting.description ?? undefined}
                          />
                        ) : setting.type === "json" ? (
                          <Textarea
                            label={label}
                            helper={setting.description ?? undefined}
                            error={jsonErrors[setting.key]}
                            value={value}
                            onChange={(event) =>
                              setDraft(setting.key, event.target.value)
                            }
                            maxLength={5000}
                            rows={6}
                            className="font-mono text-xs"
                          />
                        ) : (
                          <Input
                            label={label}
                            type={setting.type === "number" ? "number" : "text"}
                            helper={setting.description ?? undefined}
                            value={value}
                            onChange={(event) =>
                              setDraft(setting.key, event.target.value)
                            }
                            maxLength={5000}
                            className="font-mono text-xs"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* ── Sticky save bar ──────────────────────────────────────────── */}
          <div className="sticky bottom-4 z-20">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-panel/95 px-4 py-3 shadow-lg backdrop-blur">
              <div>
                <p className="text-sm text-text-primary">
                  {changedUpdates.length === 0
                    ? "No unsaved changes."
                    : `${changedUpdates.length} unsaved ${
                        changedUpdates.length === 1 ? "change" : "changes"
                      }.`}
                </p>
                {hasJsonErrors && (
                  <p className="mt-0.5 text-xs text-pink">
                    Fix the invalid JSON fields before saving.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrafts({})}
                  disabled={changedUpdates.length === 0 || saving}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={() => void save()}
                  loading={saving}
                  loadingText="Saving…"
                  disabled={
                    changedUpdates.length === 0 || saving || hasJsonErrors
                  }
                  leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

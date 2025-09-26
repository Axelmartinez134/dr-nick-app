'use client'

import { useEffect, useMemo, useState } from 'react'

export default function LinkManager() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'updated_desc' | 'views_desc' | 'cta_desc'>('updated_desc')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 20

  async function load() {
    const params = new URLSearchParams({ q, sort, page: String(page), pageSize: String(pageSize) })
    const res = await fetch(`/api/marketing/links?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    if (res.ok) { setRows(json.items || []); setTotal(json.total || 0) }
  }

  useEffect(() => { if (open) load() }, [open, q, sort, page])

  return (
    <section className="bg-white rounded-lg shadow-md p-6">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50 focus:outline-none flex items-center justify-between rounded-t-lg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>{open ? '🔼' : '🔽'}</span>
          <span className="text-lg font-semibold text-gray-900">🔗 Link Manager (Active Links)</span>
        </span>
        <span className="text-sm text-gray-500">{open ? 'Click to collapse' : 'Click to expand'}</span>
      </button>
      {open && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} placeholder="Search by client, alias, or slug…" className="flex-1 px-3 py-2 border rounded" />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="px-2 py-2 border rounded">
              <option value="updated_desc">Updated desc</option>
              <option value="views_desc">Views desc</option>
              <option value="cta_desc">CTA desc</option>
            </select>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Alias</th>
                  <th className="py-2 pr-3">Current version</th>
                  <th className="py-2 pr-3">Published</th>
                  <th className="py-2 pr-3">Views</th>
                  <th className="py-2 pr-3">CTA</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.alias}-${r.currentSlug}`} className="border-t">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">{r.patient.name}</div>
                      <div className="text-gray-500 text-xs">{r.patient.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <a className="text-blue-600 underline" href={`/${r.alias}`} target="_blank">/{r.alias}</a>
                    </td>
                    <td className="py-2 pr-3">
                      <a className="text-blue-600 underline" href={`/version/${r.currentSlug}`} target="_blank">{r.currentSlug}</a>
                    </td>
                    <td className="py-2 pr-3">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{r.views}</td>
                    <td className="py-2 pr-3">{r.ctas}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <a className="px-2 py-1 border rounded text-xs" href={`/${r.alias}`} target="_blank">Open Alias</a>
                        <button className="px-2 py-1 border rounded text-xs" onClick={async () => {
                          const res = await fetch('/api/marketing/drafts/from-latest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: r.patient.id, alias: r.alias }) })
                          const json = await res.json()
                          if (!res.ok) { alert(json.error || 'Failed to create draft'); return }
                          window.location.href = `/admin/marketing/editor/${json.draftId}`
                        }}>Continue editing</button>
                        <a className="px-2 py-1 border rounded text-xs" href={`/version/${r.currentSlug}`} target="_blank">Open Version</a>
                        <button className="px-2 py-1 border rounded text-xs" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${r.alias}`)}>Copy Alias URL</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/version/${r.currentSlug}`)}>Copy Version URL</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={async () => {
                          const res = await fetch(`/api/marketing/drafts/from-latest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: r.patient.id, alias: r.alias }) })
                          const json = await res.json()
                          if (!res.ok) { alert(json.error || 'Failed'); return }
                          window.location.href = `/admin/marketing/editor/${json.draftId}`
                        }}>Change Display Label</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={async () => {
                          if (!confirm('Revoke this version?')) return
                          const res = await fetch(`/api/marketing/shares/${encodeURIComponent(r.currentSlug)}/revoke`, { method: 'POST' })
                          const j = await res.json()
                          if (!res.ok) { alert(j.error || 'Failed to revoke'); return }
                          load()
                        }}>Revoke current version</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-gray-500">No active links found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div>Showing {(rows.length && (page-1)*pageSize+1) || 0}-{Math.min(page*pageSize, total)} of {total}</div>
            <div className="flex gap-2">
              <button className="px-2 py-1 border rounded" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
              <button className="px-2 py-1 border rounded" disabled={page*pageSize>=total} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}



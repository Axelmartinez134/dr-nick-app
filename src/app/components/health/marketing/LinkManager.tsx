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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [aliasToDelete, setAliasToDelete] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

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
            <input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value) }}
              placeholder="Search by client, alias, or slug…"
              className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-2 py-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none"
            >
              <option value="updated_desc">Updated desc</option>
              <option value="views_desc">Views desc</option>
              <option value="cta_desc">CTA desc</option>
            </select>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-700">
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
                    <td className="py-2 pr-3 text-gray-900">
                      <div className="font-medium">{r.patient.name}</div>
                      <div className="text-gray-600 text-xs">{r.patient.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-gray-900">
                      <a className="text-blue-600 underline" href={`/${r.alias}`} target="_blank">/{r.alias}</a>
                    </td>
                    <td className="py-2 pr-3 text-gray-900">
                      <a className="text-blue-600 underline" href={`/version/${r.currentSlug}`} target="_blank">{r.currentSlug}</a>
                    </td>
                    <td className="py-2 pr-3 text-gray-900">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-900">{r.views}</td>
                    <td className="py-2 pr-3 text-gray-900">{r.ctas}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <a className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-800 hover:bg-gray-50" href={`/${r.alias}`} target="_blank">Open Alias</a>
                        <button className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700" onClick={async () => {
                          const res = await fetch('/api/marketing/drafts/from-latest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: r.patient.id, alias: r.alias }) })
                          const json = await res.json()
                          if (!res.ok) { alert(json.error || 'Failed to create draft'); return }
                          window.location.href = `/admin/marketing/editor/${json.draftId}`
                        }}>Continue editing</button>
                      <button
                        className="px-2 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                        onClick={() => { setAliasToDelete(r.alias); setDeleteConfirm(''); setShowDeleteModal(true) }}
                      >
                        Delete Alias
                      </button>
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
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg border w-full max-w-md p-4">
            <div className="text-sm font-semibold text-gray-900 mb-1">Delete alias "/{aliasToDelete}"</div>
            <div className="text-xs text-gray-600 mb-3">This will delete the alias, all drafts for this alias, and all marketing shares for the same patient. Profiles/health data will not be touched.</div>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-500 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded text-sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>Cancel</button>
              <button
                className={`px-3 py-1.5 rounded text-sm text-white ${deleteConfirm === 'DELETE' && !deleting ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 cursor-not-allowed'}`}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                onClick={async () => {
                  if (deleteConfirm !== 'DELETE') return
                  try {
                    setDeleting(true)
                    const res = await fetch(`/api/marketing/aliases/${encodeURIComponent(aliasToDelete)}/delete`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirm: 'DELETE' })
                    })
                    const j = await res.json()
                    if (!res.ok) { alert(j.error || 'Failed to delete alias'); setDeleting(false); return }
                    setDeleting(false)
                    setShowDeleteModal(false)
                    setDeleteConfirm('')
                    load()
                  } catch (e) {
                    setDeleting(false)
                    alert('Failed to delete alias')
                  }
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}



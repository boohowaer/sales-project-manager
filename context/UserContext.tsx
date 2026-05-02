'use client'

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'
import type { UserTeamContext } from '@/types'

export type TeamMemberRow = {
  id: string
  user_id: string
  team_id: string
  email: string
  name?: string
  role?: string
  status?: string
  data_scope?: string
  joined_at?: string
}

interface UserContextValue {
  user: UserTeamContext | null
  members: TeamMemberRow[]
  membersLoaded: boolean
  ensureMembers: () => void
  reloadMembers: () => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  members: [],
  membersLoaded: false,
  ensureMembers: () => {},
  reloadMembers: () => {},
})

export function UserProvider({ user, children }: { user: UserTeamContext | null; children: ReactNode }) {
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const inflightRef = useRef<Promise<void> | null>(null)

  const fetchMembers = useCallback(() => {
    if (inflightRef.current) return inflightRef.current
    const p = fetch('/api/admin/users')
      .then(r => (r.ok ? r.json() : []))
      .then((d: TeamMemberRow[]) => {
        if (Array.isArray(d)) setMembers(d)
        setMembersLoaded(true)
      })
      .catch(() => {})
      .finally(() => {
        inflightRef.current = null
      })
    inflightRef.current = p
    return p
  }, [])

  const ensureMembers = useCallback(() => {
    if (membersLoaded || inflightRef.current) return
    fetchMembers()
  }, [membersLoaded, fetchMembers])

  const reloadMembers = useCallback(() => {
    setMembersLoaded(false)
    inflightRef.current = null
    fetchMembers()
  }, [fetchMembers])

  return (
    <UserContext.Provider value={{ user, members, membersLoaded, ensureMembers, reloadMembers }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserTeamContext | null {
  return useContext(UserContext).user
}

export function useTeamMembers() {
  const ctx = useContext(UserContext)
  return {
    members: ctx.members,
    membersLoaded: ctx.membersLoaded,
    ensureMembers: ctx.ensureMembers,
    reloadMembers: ctx.reloadMembers,
  }
}

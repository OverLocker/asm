export class HostSearchIndex {
  constructor(hosts = []) {
    this.hosts = hosts
    this.indexBuiltAt = 0
    this.buildIndex()
  }

  buildIndex() {
    this.prefixIndex = new Map()
    this.exactIndex = new Map()
    this.aliasIndex = new Map()
    this.userIndex = new Map()
    
    for (const host of this.hosts) {
      const hostKey = host.host.toLowerCase()
      this.exactIndex.set(hostKey, host)
      this.indexPrefixes(hostKey, host)

      if (host.aliases && Array.isArray(host.aliases)) {
        for (const alias of host.aliases) {
          if (alias && alias.length > 0) {
            const aliasKey = alias.toLowerCase()
            this.aliasIndex.set(aliasKey, host)
            this.indexPrefixes(aliasKey, host)
          }
        }
      }

      if (host.user && host.user.length > 0) {
        const userKey = host.user.toLowerCase()
        this.userIndex.set(userKey, host)
        this.indexPrefixes(userKey, host)
      }
    }

    this.indexBuiltAt = Date.now()
  }

  indexPrefixes(term, host) {
    const parts = term.split(/[\s\-_.\/]+/).filter(p => p.length > 0)

    for (const part of parts) {
      for (let i = 1; i <= part.length; i++) {
        const prefix = part.substring(0, i)
        if (!this.prefixIndex.has(prefix)) {
          this.prefixIndex.set(prefix, new Set())
        }
        this.prefixIndex.get(prefix).add(host)
      }
    }
  }

  search(query) {
    if (!query || query.length === 0) {
      return this.hosts
    }

    const q = query.toLowerCase().trim()
    const resultSet = this.prefixIndex.get(q)

    if (!resultSet || resultSet.size === 0) {
      return []
    }

    const results = Array.from(resultSet)
    results.sort((a, b) => {
      const aScore = this.getRelevanceScore(a, q)
      const bScore = this.getRelevanceScore(b, q)
      return bScore - aScore
    })

    return results
  }

  getRelevanceScore(host, query) {
    let score = 0

    const hostName = host.host.toLowerCase()
    const user = (host.user || '').toLowerCase()
    const aliases = (host.aliases || []).map(a => a.toLowerCase())

    if (hostName === query) {
      return 1000
    }

    if (hostName.startsWith(query)) {
      score += 100
    }

    const hostWords = hostName.split(/[\s\-_.\/]+/)
    for (const word of hostWords) {
      if (word.startsWith(query)) {
        score += 80
      }
    }

    if (hostName.includes(query)) {
      score += 50
    }

    for (const alias of aliases) {
      if (alias === query) score += 120
      if (alias.startsWith(query)) score += 60
      if (alias.includes(query)) score += 30
    }

    if (user) {
      if (user === query) score += 100
      if (user.startsWith(query)) score += 50
      if (user.includes(query)) score += 20
    }

    return score
  }

  update(hosts) {
    this.hosts = hosts
    this.buildIndex()
  }

  getStats() {
    return {
      hostsCount: this.hosts.length,
      prefixesCount: this.prefixIndex.size,
      builtAt: new Date(this.indexBuiltAt).toLocaleTimeString(),
    }
  }
}
